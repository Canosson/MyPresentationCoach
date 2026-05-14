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

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  return `${s}s`;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const [fileState, setFileState] = useState<FileState>({ status: 'idle' });
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // Reset upload errors when a new file is picked.
    setUploadState({ phase: 'idle' });

    if (!file) {
      setFileState({ status: 'idle' });
      return;
    }

    if (file.type !== 'video/mp4') {
      setFileState({ status: 'invalid', reason: 'Only MP4 files are accepted.' });
      return;
    }

    // Validate duration using a hidden <video> element.
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
          reason: `Video is ${Math.ceil(duration)}s long. Maximum allowed is ${MAX_DURATION_SECONDS}s.`,
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

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: recordingId }),
      });

      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Analysis failed (${analyzeRes.status})`);
      }

      router.push(`/recordings/${recordingId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setUploadState({ phase: 'error', message });
    }
  }

  const isUploading = uploadState.phase === 'uploading';
  const isAnalyzing = uploadState.phase === 'analyzing';
  const isBusy = isUploading || isAnalyzing;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Analyze your presentation
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Upload an MP4 clip up to 10 seconds. We&apos;ll score your framing,
            lighting, eye contact, posture, and vocal presence.
          </p>
        </div>

        {/* Hidden video element used only for duration validation */}
        <video ref={hiddenVideoRef} className="hidden" aria-hidden="true" />

        {/* File picker */}
        <div>
          <label
            className={[
              'flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
              fileState.status === 'invalid'
                ? 'border-red-300 bg-red-50'
                : fileState.status === 'ready'
                ? 'border-green-300 bg-green-50'
                : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100',
              isBusy ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-zinc-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>

            {fileState.status === 'ready' ? (
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-800 truncate max-w-xs">
                  {fileState.file.name}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Duration: {formatDuration(fileState.durationSeconds)}
                </p>
                <p className="text-xs text-zinc-400 mt-1">Click to change file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">
                  Click to select an MP4
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">Max 10 seconds</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isBusy}
            />
          </label>

          {/* Validation error */}
          {fileState.status === 'invalid' && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {fileState.reason}
            </p>
          )}
        </div>

        {/* Progress bar — shown only while uploading */}
        {isUploading && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Uploading…</span>
              <span>{uploadState.pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 overflow-hidden">
              <div
                className="h-full bg-zinc-900 [transition:width_300ms_ease-out]"
                style={{ width: `${uploadState.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Analyzing state */}
        {isAnalyzing && (
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 shrink-0" />
            <span>Analyzing your video&hellip; this takes about 15 seconds</span>
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
            'w-full h-12 rounded-xl text-sm font-semibold [transition:background-color_150ms_ease-out,transform_100ms_ease-out]',
            fileState.status === 'ready' && !isBusy
              ? 'bg-zinc-900 text-white hover:bg-zinc-700 active:scale-[0.97] cursor-pointer'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed',
          ].join(' ')}
        >
          {isUploading ? 'Uploading…' : isAnalyzing ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
    </div>
  );
}
