'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * uploadRecording
 *
 * 1. POSTs to /api/recordings to create a `recordings` row and get back
 *    { id, storage_path }.
 * 2. Uploads the file directly to Supabase Storage using the anon session.
 * 3. Calls onProgress with discrete steps (0 → 50 → 100) because the
 *    Supabase JS client does not expose byte-level upload progress.
 *
 * @returns The recording id on success.
 * @throws  A descriptive Error on any failure.
 */
export async function uploadRecording(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  onProgress(0);

  // Step 1: create the recordings row and receive the storage path.
  const rowRes = await fetch('/api/recordings', { method: 'POST' });

  if (!rowRes.ok) {
    let detail = `HTTP ${rowRes.status}`;
    try {
      const body = (await rowRes.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // ignore json parse failures
    }
    throw new Error(`Failed to create recording: ${detail}`);
  }

  const { id, storage_path } = (await rowRes.json()) as {
    id: string;
    storage_path: string;
  };

  onProgress(50);

  // Step 2: upload the file directly to Supabase Storage.
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(storage_path, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  onProgress(100);

  return id;
}
