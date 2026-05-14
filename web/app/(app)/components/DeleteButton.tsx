'use client';

import { useTransition } from 'react';
import { deleteRecording } from '@/lib/actions';

export default function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await deleteRecording(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 [transition:background-color_120ms_ease-out,color_120ms_ease-out,transform_100ms_ease-out] hover:bg-zinc-200 hover:text-zinc-700 active:scale-[0.97] disabled:opacity-40"
      aria-label="Delete recording"
    >
      {isPending ? (
        <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="20" strokeDashoffset="14" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
