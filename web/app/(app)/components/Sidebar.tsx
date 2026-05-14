'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { deleteRecording } from '@/lib/actions';

type Recording = {
  id: string;
  status: string;
  created_at: string;
  has_report: boolean;
};

function statusDot(status: string) {
  switch (status) {
    case 'ready':
    case 'partial':
      return 'bg-emerald-400';
    case 'analyzing':
    case 'pending':
      return 'bg-amber-400 animate-pulse';
    case 'failed':
      return 'bg-red-400';
    default:
      return 'bg-zinc-300';
  }
}

// Inline SVGs — no icon library required
function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M7.5 1.5v9M4.5 4.5l3-3 3 3M2.5 11.5v1a1 1 0 001 1h8a1 1 0 001-1v-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M2 4h11M2 7.5h11M2 11h7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <path d="M8.5 2.5l-6 6M2.5 2.5l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" strokeDasharray="18" strokeDashoffset="13" strokeLinecap="round" />
    </svg>
  );
}

const NAV = [
  { href: '/upload', label: 'Upload', Icon: IconUpload },
  { href: '/recordings', label: 'Reports', Icon: IconList },
];

export default function Sidebar({ recordings }: { recordings: Recording[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await deleteRecording(id);
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 sticky top-0 h-[100dvh] border-r border-zinc-200/80 bg-white overflow-y-auto">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-zinc-100">
        <div className="flex items-start gap-2.5">
          {/* Logo mark */}
          <div className="w-7 h-7 shrink-0 bg-zinc-900 rounded-md flex items-center justify-center mt-0.5">
            <span className="text-white text-[11px] font-bold font-mono tracking-tight">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-900 leading-snug">
              My Presentation Coach
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug">
              Build strong skills today;<br />decide your future.
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 border-b border-zinc-100">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium [transition:background-color_120ms_cubic-bezier(0.23,1,0.32,1),color_120ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]',
                'active:scale-[0.97]',
                active
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              ].join(' ')}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Recent recordings */}
      <div className="px-3 py-3 flex-1">
        {recordings.length === 0 ? (
          <p className="px-3 text-[11px] text-zinc-400 mt-1">No recordings yet.</p>
        ) : (
          <>
            <p className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Recent
            </p>
            <ul className="space-y-0.5">
              {recordings.map((r) => {
                const isDeleting = pendingId === r.id;
                const clickable = (r.status === 'ready' || r.status === 'partial') && r.has_report;
                const date = new Date(r.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <li
                    key={r.id}
                    className={[
                      'group flex items-center gap-2 px-3 py-2 rounded-lg [transition:background-color_120ms_ease-out,opacity_200ms_ease-out]',
                      clickable ? 'hover:bg-zinc-50' : '',
                      isDeleting ? 'opacity-40 pointer-events-none' : '',
                    ].join(' ')}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(r.status)}`} />

                    <div className="flex-1 min-w-0">
                      {clickable ? (
                        <Link
                          href={`/recordings/${r.id}`}
                          className="block text-[12px] text-zinc-700 truncate [transition:color_120ms_ease-out] hover:text-zinc-900"
                        >
                          {date}
                        </Link>
                      ) : (
                        <span className="block text-[12px] text-zinc-400 truncate">{date}</span>
                      )}
                      <span className="text-[10px] text-zinc-400 capitalize">{r.status}</span>
                    </div>

                    {/* Delete — visible on row hover */}
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={isDeleting || isPending}
                      className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-zinc-400 [transition:opacity_150ms_ease-out,background-color_120ms_ease-out,color_120ms_ease-out] hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-30"
                      aria-label="Delete recording"
                    >
                      {isDeleting ? <IconSpinner /> : <IconX />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
