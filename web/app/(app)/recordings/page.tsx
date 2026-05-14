import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DeleteButton from '../components/DeleteButton';

const STATUS_CHIP: Record<string, string> = {
  ready: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  analyzing: 'bg-blue-50 text-blue-700',
  pending: 'bg-zinc-100 text-zinc-600',
  failed: 'bg-red-50 text-red-700',
};

export default async function RecordingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('recordings')
    .select('id, status, created_at, reports(id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const recordings = (rows ?? []).map((r) => ({
    id: r.id as string,
    status: r.status as string,
    created_at: r.created_at as string,
    has_report: Array.isArray(r.reports) ? r.reports.length > 0 : r.reports !== null,
  }));

  return (
    <div className="px-8 py-10 md:px-10 md:py-12">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">
            History
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            All Reports
          </h1>
        </div>

        {recordings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
            <p className="text-sm text-zinc-500 mb-4">No recordings yet.</p>
            <Link
              href="/upload"
              className="inline-block bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl [transition:background-color_150ms_ease-out,transform_100ms_ease-out] hover:bg-zinc-800 active:scale-[0.97]"
            >
              Upload your first video
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
            {recordings.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-5 py-3.5"
                style={{
                  animation: 'fade-up 250ms var(--ease-out) both',
                  animationDelay: `${i * 35}ms`,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md capitalize ${STATUS_CHIP[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {r.status}
                  </span>
                  <p className="text-sm text-zinc-600 truncate">
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {(r.status === 'ready' || r.status === 'partial') && r.has_report && (
                    <Link
                      href={`/recordings/${r.id}`}
                      className="text-[13px] font-medium text-zinc-700 [transition:color_150ms_ease-out] hover:text-zinc-900"
                    >
                      View &rarr;
                    </Link>
                  )}
                  <DeleteButton id={r.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
