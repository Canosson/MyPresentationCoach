import { createClient, createServiceClient } from '@/lib/supabase/server';
import { analyzeVideoVisuals, type VisualDimension } from '@/lib/ai/gemini';

type PythonDimension = {
  dimension: 'vocal_presence';
  score: number;
  observation: string;
  fix: string;
  metrics?: Record<string, number>;
};

async function callPythonService(storagePath: string): Promise<PythonDimension> {
  const url = process.env.PYTHON_SERVICE_URL!;
  const secret = process.env.PYTHON_SERVICE_SECRET!;

  const res = await fetch(`${url}/analyze-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ storage_path: storagePath }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Python service error (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<PythonDimension>;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { recording_id?: string };
  try {
    body = (await request.json()) as { recording_id?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { recording_id: recordingId } = body;
  if (!recordingId) {
    return Response.json({ error: 'recording_id is required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: recording } = await serviceClient
    .from('recordings')
    .select('id, user_id, storage_path, status')
    .eq('id', recordingId)
    .single();

  if (!recording || recording.user_id !== user.id) {
    return Response.json({ error: 'Recording not found' }, { status: 404 });
  }

  // Idempotency — return existing report without re-running analysis
  const { data: existingReport } = await serviceClient
    .from('reports')
    .select('payload')
    .eq('recording_id', recordingId)
    .maybeSingle();

  if (existingReport) {
    return Response.json({ report: existingReport.payload, recording_id: recordingId });
  }

  await serviceClient
    .from('recordings')
    .update({ status: 'analyzing' })
    .eq('id', recordingId);

  try {
    const [geminiResult, pythonResult] = await Promise.allSettled([
      analyzeVideoVisuals(recording.storage_path),
      callPythonService(recording.storage_path),
    ]);

    const dimensions: Array<VisualDimension | Omit<PythonDimension, 'metrics'>> = [];

    if (geminiResult.status === 'fulfilled') {
      dimensions.push(...geminiResult.value);
    }

    if (pythonResult.status === 'fulfilled') {
      // Strip metrics from the stored payload — it's for debugging only
      const { dimension, score, observation, fix } = pythonResult.value;
      dimensions.push({ dimension, score, observation, fix });
    }

    if (dimensions.length === 0) {
      const geminiReason =
        geminiResult.status === 'rejected' ? String(geminiResult.reason) : '';
      const pythonReason =
        pythonResult.status === 'rejected' ? String(pythonResult.reason) : '';

      await serviceClient
        .from('recordings')
        .update({
          status: 'failed',
          error_reason: [geminiReason, pythonReason].filter(Boolean).join(' | ').slice(0, 500),
        })
        .eq('id', recordingId);

      return Response.json({ error: 'Analysis failed', reason: 'Both analyzers failed' }, { status: 502 });
    }

    const partial = dimensions.length < 6;
    const report = {
      dimensions,
      generated_at: new Date().toISOString(),
      partial,
    };

    await serviceClient.from('reports').insert({ recording_id: recordingId, payload: report });

    await serviceClient
      .from('recordings')
      .update({ status: partial ? 'partial' : 'ready' })
      .eq('id', recordingId);

    return Response.json({ report, recording_id: recordingId });
  } catch (err) {
    await serviceClient
      .from('recordings')
      .update({
        status: 'failed',
        error_reason: String(err).slice(0, 500),
      })
      .eq('id', recordingId);

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
