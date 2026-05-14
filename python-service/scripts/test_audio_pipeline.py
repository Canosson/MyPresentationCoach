"""
Smoke-test for the ffmpeg + librosa audio pipeline.

Usage:
    python python-service/scripts/test_audio_pipeline.py [path/to/video.mp4]

If no path is given, defaults to docs/test-clip.mp4 relative to the repo root.
The script generates docs/test-clip.mp4 automatically if it does not exist.

Exit codes:
    0 — all checks passed
    1 — at least one check failed
"""

import os
import sys
import json
import subprocess
import tempfile
import pathlib

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_TEST_CLIP = REPO_ROOT / "docs" / "test-clip.mp4"


# ---------------------------------------------------------------------------
# Step 0 — Generate a synthetic test clip if needed
# ---------------------------------------------------------------------------

def generate_test_clip(dest: pathlib.Path) -> None:
    """Use ffmpeg to produce a 7-second MP4 with a 440 Hz sine-wave audio track."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        # Video stream: 7s of solid black 640x480 at 25fps
        "-f", "lavfi", "-i", "color=c=black:size=640x480:rate=25",
        # Audio stream: 440 Hz sine wave at -14 dBFS
        "-f", "lavfi", "-i", "sine=frequency=440:beep_factor=0.5:sample_rate=44100",
        "-t", "7",
        "-c:v", "libx264", "-c:a", "aac",
        "-shortest",
        str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR: ffmpeg failed to generate test clip.")
        print(result.stderr[-2000:])
        sys.exit(1)
    print(f"[OK] Generated synthetic test clip: {dest}")


# ---------------------------------------------------------------------------
# Step 1 — Extract audio with ffmpeg
# ---------------------------------------------------------------------------

def extract_audio(video_path: pathlib.Path, wav_path: pathlib.Path) -> None:
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",                    # drop video
        "-ac", "1",               # mono
        "-ar", "16000",           # 16 kHz — same as production pipeline
        "-f", "wav",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR: ffmpeg audio extraction failed.")
        print(result.stderr[-2000:])
        sys.exit(1)
    print(f"[OK] ffmpeg extracted audio to {wav_path}")


# ---------------------------------------------------------------------------
# Step 2 — Compute metrics with librosa
# ---------------------------------------------------------------------------

def compute_metrics(wav_path: pathlib.Path) -> dict:
    import numpy as np
    import librosa

    y, sr = librosa.load(str(wav_path), sr=None, mono=True)
    duration_seconds = float(len(y) / sr)

    # RMS energy -> dB
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=1.0)

    # Guard against all-silent input (rms_db would be all -inf / -80)
    finite_rms = rms_db[np.isfinite(rms_db)]
    if len(finite_rms) == 0:
        finite_rms = np.array([-80.0])

    mean_db = float(np.mean(finite_rms))
    std_db = float(np.std(finite_rms))
    max_db = float(np.max(finite_rms))
    min_db = float(np.min(finite_rms))
    dynamic_range_db = float(max_db - min_db)

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
# Step 3 — Score vocal presence (rubric from docs/CONTRACTS.md)
# ---------------------------------------------------------------------------

def score_vocal_presence(metrics: dict) -> tuple[int, str, str]:
    """
    Rubric (from docs/CONTRACTS.md):

    Score 5 — Excellent
      mean_db > -22 AND silence_ratio < 0.15 AND std_db between 3-7

    Score 4 — Good
      mean_db > -26 AND silence_ratio < 0.20

    Score 3 — Acceptable
      mean_db > -32 AND silence_ratio < 0.30

    Score 2 — Weak
      mean_db > -38 OR silence_ratio < 0.45

    Score 1 — Inaudible / silent
      mean_db <= -38 OR silence_ratio >= 0.45 OR duration_audible < 2s
    """
    mean_db = metrics["mean_db"]
    std_db = metrics["std_db"]
    silence_ratio = metrics["silence_ratio"]
    duration_seconds = metrics["duration_seconds"]

    # Score 1 guard
    if mean_db <= -38 or silence_ratio >= 0.45 or duration_seconds < 2.0:
        return 1, "No audible voice detected in this clip.", (
            "Record in a quiet space and speak clearly toward the microphone."
        )

    if mean_db > -22 and silence_ratio < 0.15 and 3.0 <= std_db <= 7.0:
        score = 5
    elif mean_db > -26 and silence_ratio < 0.20:
        score = 4
    elif mean_db > -32 and silence_ratio < 0.30:
        score = 3
    elif mean_db > -38:
        score = 2
    else:
        score = 1

    # Dominant-weakness observation
    if silence_ratio > 0.30:
        observation = "Long silent gaps detected — your voice is absent for extended periods."
        fix = "Try to maintain a steady pace and reduce pauses to under one second."
    elif mean_db < -30:
        observation = "Your voice is quieter than recruiters expect for a recorded interview."
        fix = "Move your mouth closer to the microphone or raise your speaking volume by one notch."
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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    video_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TEST_CLIP

    print("=" * 60)
    print("MyPresentationCoach — Audio Pipeline Smoke Test")
    print("=" * 60)

    # Generate test clip if not present
    if not video_path.exists():
        print(f"Test clip not found at {video_path}. Generating...")
        generate_test_clip(video_path)

    print(f"\n[INFO] Testing with: {video_path}")
    print(f"[INFO] File size: {video_path.stat().st_size / 1024:.1f} KB")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = pathlib.Path(tmp.name)

    try:
        # Step 1: extract audio
        print("\n--- Step 1: ffmpeg audio extraction ---")
        extract_audio(video_path, wav_path)

        # Step 2: compute metrics
        print("\n--- Step 2: librosa metric computation ---")
        metrics = compute_metrics(wav_path)
        for k, v in metrics.items():
            print(f"  {k}: {v}")

        # Validate all metrics are numeric and present
        required_keys = {"mean_db", "std_db", "silence_ratio", "dynamic_range_db", "duration_seconds"}
        missing = required_keys - set(metrics.keys())
        if missing:
            print(f"\nFAIL: Missing metric keys: {missing}")
            sys.exit(1)
        for k, v in metrics.items():
            if not isinstance(v, (int, float)) or v != v:  # NaN check
                print(f"\nFAIL: Metric '{k}' has invalid value: {v}")
                sys.exit(1)
        print("[OK] All 5 metrics present and numeric.")

        # Step 3: score
        print("\n--- Step 3: Vocal presence scoring ---")
        score, observation, fix = score_vocal_presence(metrics)
        print(f"  score:       {score} / 5")
        print(f"  observation: {observation}")
        print(f"  fix:         {fix}")

        if not (1 <= score <= 5):
            print(f"\nFAIL: Score {score} is out of range 1–5.")
            sys.exit(1)
        print("[OK] Score is in valid range 1–5.")

        # Full result as JSON
        result = {
            "dimension": "vocal_presence",
            "score": score,
            "observation": observation,
            "fix": fix,
            "metrics": metrics,
        }
        print("\n--- Full result (JSON) ---")
        print(json.dumps(result, indent=2))

        print("\n" + "=" * 60)
        print("ALL CHECKS PASSED — ffmpeg + librosa pipeline is working.")
        print("=" * 60)

    finally:
        if wav_path.exists():
            wav_path.unlink()
            print(f"\n[cleanup] Removed temp WAV: {wav_path}")


if __name__ == "__main__":
    main()
