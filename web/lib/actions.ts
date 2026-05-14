'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function deleteRecording(recordingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  // Fetch storage path before deleting the row
  const { data: recording } = await supabase
    .from('recordings')
    .select('storage_path')
    .eq('id', recordingId)
    .eq('user_id', user.id)
    .single();

  // Delete report first (FK constraint)
  await supabase.from('reports').delete().eq('recording_id', recordingId);

  // Delete recording row — RLS enforces user ownership
  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  // Best-effort storage cleanup via service client (bypasses storage RLS)
  if (recording?.storage_path) {
    const svc = createServiceClient();
    await svc.storage.from('recordings').remove([recording.storage_path]).catch(() => null);
  }

  revalidatePath('/', 'layout');
}
