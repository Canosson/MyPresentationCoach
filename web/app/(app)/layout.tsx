import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from './components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    .limit(8);

  const recordings = (rows ?? []).map((r) => ({
    id: r.id as string,
    status: r.status as string,
    created_at: r.created_at as string,
    has_report: Array.isArray(r.reports) ? r.reports.length > 0 : r.reports !== null,
  }));

  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar recordings={recordings} />
      <main className="flex-1 min-w-0 bg-zinc-50">{children}</main>
    </div>
  );
}
