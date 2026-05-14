'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadRecording } from '@/lib/upload';

type FileState =
  | { status: 'idle' }
  | { status: 'invalid'; reason: string }
  | { status: 'ready'; file: File; durationSeconds: number };

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; pct: number }
  | { phase: 'analyzing' }
  | { phase: 'error'; message: string };

const MAX_DURATION_SECONDS = 10;

const SCORE_DIMENSIONS = [
  { label: 'Framing', desc: 'Camera placement & composition' },
  { label: 'Lighting', desc: 'Brightness, exposure & shadows' },
  { label: 'Background', desc: 'Setting & visual noise' },
  { label: 'Eye Contact', desc: 'Gaze toward the camera lens' },
  { label: 'Posture', desc: 'Body language & alignment' },
  { label: 'Vocal Presence', desc: 'Tone, volume & clarity' },
];

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds)}s`;
}

export default function UploadPage() {
  const router = useRouter();
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const [fileState, setFileState] = useState<FileState>({ status: 'idle' });
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUploadState({ phase: 'idle' });

    if (!file) {
      setFileState({ status: 'idle' });
      return;
    }

    if (file.type !== 'video/mp4') {
      setFileState({ status: 'invalid', reason: 'Only MP4 files are accepted.' });
      return;
    }

    const videoEl = hiddenVideoRef.current;
    if (!videoEl) return;

    const objectUrl = URL.createObjectURL(file);
    videoEl.src = objectUrl;

    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duration = videoEl.duration;

      if (!isFinite(duration)) {
        setFileState({
          status: 'invalid',
          reason: 'Could not determine video duration. Please try a different file.',
        });
        return;
      }

      if (duration > MAX_DURATION_SECONDS) {
        setFileState({
          status: 'invalid',
          reason: `Video is ${Math.ceil(duration)}s. Maximum allowed is ${MAX_DURATION_SECONDS}s.`,
        });
        return;
      }

      setFileState({ status: 'ready', file, durationSeconds: duration });
    };

    videoEl.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFileState({
        status: 'invalid',
        reason: 'Could not read the video file. Please try a different file.',
      });
    };
  }

  async function handleAnalyze() {
    if (fileState.status !== 'ready') return;
    setUploadState({ phase: 'uploading', pct: 0 });

    try {
      const recordingId = await uploadRecording(fileState.file, (pct) => {
        setUploadState({ phase: 'uploading', pct });
      });

      setUploadState({ phase: 'analyzing' });

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: recordingId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Analysis failed (${res.status})`);
      }

      router.push(`/recordings/${recordingId}`);
    } catch (err) {
      setUploadState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  }

  const isUploading = uploadState.phase === 'uploading';
  const isAnalyzing = uploadState.phase === 'analyzing';
  const isBusy = isUploading || isAnalyzing;

  return (
    <div className="px-8 py-10 md:px-10 md:py-12">
      {/* Hidden video element for duration validation */}
      <video ref={hiddenVideoRef} className="hidden" aria-hidden="true" />

      {/* Header — left-aligned, no centering */}
      <div className="mb-10">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">
          AI Video Analysis
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 leading-tight">
          Analyze your presentation.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-[52ch]">
          Build strong presentation skills today; decide your future.
        </p>
      </div>

      {/* Main grid: upload (left) + what we score (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 max-w-4xl">

        {/* Left column: upload + controls */}
        <div className="flex flex-col gap-4">

          {/* Drop zone */}
          <label
            className={[
              'flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer [transition:border-color_150ms_cubic-bezier(0.23,1,0.32,1),background-color_150ms_cubic-bezier(0.23,1,0.32,1)]',
              fileState.status === 'invalid'
                ? 'border-red-300 bg-red-50'
                : fileState.status === 'ready'
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50',
              isBusy ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <svg
              className={`mb-4 [transition:color_150ms_ease-out] ${fileState.status === 'ready' ? 'text-emerald-500' : fileState.status === 'invalid' ? 'text-red-400' : 'text-zinc-300'}`}
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 22v3a3 3 0 003 3h14a3 3 0 003-3v-3M16 4v18M9 11l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {fileState.status === 'ready' ? (
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-800 truncate max-w-[28ch]">
                  {fileState.file.name}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatDuration(fileState.durationSeconds)} &middot; MP4
                </p>
                <p className="text-xs text-zinc-400 mt-2">Click to change file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">Click to select an MP4</p>
                <p className="text-xs text-zinc-400 mt-1">Max 10 seconds</p>
              </div>
            )}

            <input
              type="file"
              accept="video/mp4"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isBusy}
            />
          </label>

          {/* Validation error */}
          {fileState.status === 'invalid' && (
            <p className="text-sm text-red-600" role="alert">
              {fileState.reason}
            </p>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Uploading</span>
                <span>{uploadState.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full bg-zinc-900 rounded-full [transition:width_300ms_cubic-bezier(0.23,1,0.32,1)]"
                  style={{ width: `${uploadState.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {isAnalyzing && (
            <div className="flex items-center gap-3 text-sm text-zinc-600 bg-white rounded-xl border border-zinc-200 px-4 py-3">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 shrink-0" />
              <span>Analyzing your video&hellip; about 15 seconds</span>
            </div>
          )}

          {/* Upload error */}
          {uploadState.phase === 'error' && (
            <p className="text-sm text-red-600" role="alert">
              {uploadState.message}
            </p>
          )}

          {/* Analyze button */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={fileState.status !== 'ready' || isBusy}
            className={[
              'w-full h-12 rounded-xl text-sm font-semibold [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]',
              fileState.status === 'ready' && !isBusy
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.97] cursor-pointer'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed',
            ].join(' ')}
          >
            {isUploading ? 'Uploading…' : isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {/* Right column: what we score */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 sticky top-8">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              What we score
            </p>
            <ul className="space-y-4">
              {SCORE_DIMENSIONS.map((d, i) => (
                <li
                  key={d.label}
                  className="flex flex-col"
                  style={{
                    animation: 'fade-up 300ms var(--ease-out) both',
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <span className="text-[13px] font-medium text-zinc-800">{d.label}</span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">{d.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
