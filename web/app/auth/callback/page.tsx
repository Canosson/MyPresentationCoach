'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function handle() {
      const code = new URLSearchParams(window.location.search).get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        router.replace(error ? '/login?error=auth' : '/');
        return;
      }

      // Implicit flow — tokens arrive in the URL hash (e.g. from admin generate_link)
      const hash = new URLSearchParams(window.location.hash.slice(1));

      const hashError = hash.get('error');
      if (hashError) {
        const desc = hash.get('error_description') ?? hashError;
        router.replace(`/login?error=${encodeURIComponent(desc)}`);
        return;
      }

      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        router.replace(error ? '/login?error=auth' : '/');
        return;
      }

      router.replace('/login?error=auth');
    }

    handle();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing in…</p>
    </main>
  );
}
