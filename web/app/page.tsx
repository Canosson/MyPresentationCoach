import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/upload');

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight leading-tight mb-4">
          See yourself the way recruiters do
        </h1>
        <p className="text-base text-zinc-500 leading-relaxed mb-8">
          Upload a 10-second practice video. Get a Glass Box report on your framing,
          lighting, eye contact, posture, and vocal presence.
        </p>
        <Link
          href="/login"
          className="inline-block bg-zinc-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-zinc-700 transition-colors"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
