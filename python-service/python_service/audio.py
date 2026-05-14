"""
Shared audio analysis module for MyPresentationCoach.

Provides three pure functions:
  - extract_audio(video_path, wav_path)  — runs ffmpeg as a subprocess
  - compute_metrics(wav_path)            — returns the 5 numeric metrics
  - score_vocal_presence(metrics)        — maps metrics to a 1-5 score + text

The scoring rubric is documented inline and matches docs/CONTRACTS.md.
"""

import subprocess
import pathlib
import numpy as np
import librosa


# ---------------------------------------------------------------------------
# Step 1 — Extract audio with ffmpeg
# ---------------------------------------------------------------------------

def extract_audio(video_path: pathlib.Path, wav_path: pathlib.Path) -> None:
    """
    Extract mono 16 kHz WAV from *video_path*, writing to *wav_path*.

    Raises RuntimeError if ffmpeg exits non-zero.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",          # drop video stream
        "-ac", "1",     # mono
        "-ar", "16000", # 16 kHz
        "-f", "wav",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg audio extraction failed (exit {result.returncode}): "
            f"{result.stderr[-1000:]}"
        )


# ---------------------------------------------------------------------------
# Step 2 — Compute metrics with librosa
# ---------------------------------------------------------------------------

def compute_metrics(wav_path: pathlib.Path) -> dict:
    """
    Load the WAV file and return a dict with 5 metrics:
      mean_db          — mean RMS loudness in dB
      std_db           — standard deviation of RMS loudness
      silence_ratio    — fraction of frames below -45 dB
      dynamic_range_db — 95th-pct minus 5th-pct of RMS dB values
      duration_seconds — total clip duration

    On a fully silent clip every value is still a valid float so callers
    never need to guard for NaN/None.
    """
    y, sr = librosa.load(str(wav_path), sr=None, mono=True)
    duration_seconds = float(len(y) / sr)

    # RMS energy frame-by-frame -> dB
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=1.0)

    # Guard against all-silent input (rms_db would be all -inf / -80)
    finite_rms = rms_db[np.isfinite(rms_db)]
    if len(finite_rms) == 0:
        finite_rms = np.array([-80.0])

    mean_db = float(np.mean(finite_rms))
    std_db = float(np.std(finite_rms))

    # Use percentile-based dynamic range (more robust than raw min/max)
    p5 = float(np.percentile(finite_rms, 5))
    p95 = float(np.percentile(finite_rms, 95))
    dynamic_range_db = p95 - p5

    # Silence: fraction of ALL frames (including -inf) below threshold
    silence_threshold_db = -45.0
    silence_ratio = float(np.mean(rms_db < silence_threshold_db))

    return {
        "mean_db": round(mean_db, 2),
        "std_db": round(std_db, 2),
        "silence_ratio": round(silence_ratio, 4),
        "dynamic_range_db": round(dynamic_range_db, 2),
        "duration_seconds": round(duration_seconds, 2),
    }


# ---------------------------------------------------------------------------
# Step 3 — Score vocal presence
# ---------------------------------------------------------------------------

def score_vocal_presence(metrics: dict) -> tuple[int, str, str]:
    """
    Map computed metrics to a 1-5 Vocal Presence score plus a single
    observation/fix pair focused on the dominant weakness.

    Rubric (laptop-mic calibrated — typical built-in mic at 0.5–1.5 m):
    ─────────────────────────────────────────────────────────────────
    Score 5 — Excellent
      mean_db > -30 AND silence_ratio < 0.20 AND std_db between 3–7

    Score 4 — Good
      mean_db > -35 AND silence_ratio < 0.25

    Score 3 — Acceptable
      mean_db > -41 AND silence_ratio < 0.40

    Score 2 — Weak
      mean_db > -50

    Score 1 — Inaudible / silent
      (mean_db <= -50 AND silence_ratio >= 0.60) OR std_db < 1.5 OR duration_seconds < 2s
    ─────────────────────────────────────────────────────────────────

    Observation selection (dominant weakness, evaluated in priority order):
      silence_ratio > 0.30 → long silent gaps
      mean_db < -30        → voice too quiet
      std_db < 2           → monotone delivery
      std_db > 9           → volume varies sharply
      else                 → strong vocal presence
    """
    mean_db = metrics["mean_db"]
    std_db = metrics["std_db"]
    silence_ratio = metrics["silence_ratio"]
    duration_seconds = metrics["duration_seconds"]

    # Score 1 guard — truly no audible content (both conditions must be bad,
    # because laptop mics routinely produce -40 to -48 dB at normal distance).
    # High std_db (>8) signals real speech variation even if mean is low.
    truly_silent = (mean_db <= -50 and silence_ratio >= 0.60) or std_db < 1.5
    if duration_seconds < 2.0 or truly_silent:
        return (
            1,
            "No audible voice detected in this clip.",
            "Record in a quiet space and speak clearly toward the microphone.",
        )

    # Assign score (first matching rule wins).
    # Thresholds are calibrated for laptop built-in mics at ~0.5–1.5 m distance,
    # which typically produce mean_db in the -35 to -48 dB range.
    if mean_db > -30 and silence_ratio < 0.20 and 3.0 <= std_db <= 7.0:
        score = 5
    elif mean_db > -35 and silence_ratio < 0.25:
        score = 4
    elif mean_db > -41 and silence_ratio < 0.40:
        score = 3
    elif mean_db > -50:
        score = 2
    else:
        score = 1

    # Dominant-weakness observation (evaluated independently of score).
    # Check quiet voice before gaps — low mean_db is usually the root cause.
    if mean_db < -38:
        observation = "Your voice is quieter than recruiters expect for a recorded interview."
        fix = "Move your mouth closer to the microphone or raise your speaking volume by one notch."
    elif silence_ratio > 0.35:
        observation = "Long silent gaps detected — your voice is absent for extended periods."
        fix = "Try to maintain a steady pace and reduce pauses to under one second."
    elif std_db < 2.0:
        observation = "Your delivery sounds monotone — loudness barely varies across the clip."
        fix = "Emphasise key words by naturally raising your volume on them."
    elif std_db > 9.0:
        observation = "Your volume varies sharply, creating an uneven listening experience."
        fix = "Aim for a consistent volume level; avoid dropping off at the end of sentences."
    else:
        observation = "Strong, consistent vocal presence throughout the clip."
        fix = "Keep up the consistent projection — consider adding slight volume emphasis on key points."

    return score, observation, fix
