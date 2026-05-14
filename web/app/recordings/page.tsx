import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-green-50 text-green-700',
  partial: 'bg-yellow-50 text-yellow-700',
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
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Your Recordings
          </h1>
          <Link
            href="/upload"
            className="bg-zinc-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            Analyze new video
          </Link>
        </div>

        {recordings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
            <p className="text-sm text-zinc-500 mb-4">No recordings yet.</p>
            <Link
              href="/upload"
              className="inline-block bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Upload your first video
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recordings.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-zinc-200 px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-zinc-800">
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <span
                    className={`mt-1 inline-block text-xs px-2 py-0.5 rounded capitalize ${STATUS_STYLES[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {r.status}
                  </span>
                </div>

                {(r.status === 'ready' || r.status === 'partial') && r.has_report && (
                  <Link
                    href={`/recordings/${r.id}`}
                    className="text-sm font-medium text-zinc-900 hover:underline"
                  >
                    View report &rarr;
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
