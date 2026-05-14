'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function deleteRecording(recordingId: string): Promise<void> {
  // Verify the caller owns the recording (anon client, respects RLS)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: recording } = await supabase
    .from('recordings')
    .select('id, storage_path')
    .eq('id', recordingId)
    .eq('user_id', user.id)
    .single();

  if (!recording) throw new Error('Recording not found');

  // No DELETE RLS policies exist — use service client to bypass RLS.
  // Ownership is already confirmed above.
  const svc = createServiceClient();

  // reports.recording_id has ON DELETE CASCADE so this single delete is enough
  const { error } = await svc
    .from('recordings')
    .delete()
    .eq('id', recordingId);

  if (error) throw new Error(error.message);

  // Best-effort storage cleanup
  if (recording.storage_path) {
    await svc.storage.from('recordings').remove([recording.storage_path]).catch(() => null);
  }

  revalidatePath('/', 'layout');
}
