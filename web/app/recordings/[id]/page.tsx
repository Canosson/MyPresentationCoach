import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/lib/schemas/report';

const DIMENSION_LABELS: Record<string, string> = {
  framing: 'Framing',
  lighting: 'Lighting',
  background: 'Background',
  eye_contact: 'Eye Contact',
  posture: 'Posture',
  vocal_presence: 'Vocal Presence',
};

const SCORE_STYLES: Record<number, string> = {
  5: 'bg-green-100 text-green-800',
  4: 'bg-green-50 text-green-700',
  3: 'bg-yellow-50 text-yellow-700',
  2: 'bg-orange-50 text-orange-700',
  1: 'bg-red-50 text-red-700',
};

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1.5 mt-3 mb-4">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < score ? 'bg-zinc-800' : 'bg-zinc-200'}`}
        />
      ))}
    </div>
  );
}

type Dimension = {
  dimension: string;
  score: number;
  observation: string;
  fix: string;
};

function DimensionCard({ dim }: { dim: Dimension }) {
  const scoreStyle = SCORE_STYLES[dim.score] ?? 'bg-zinc-100 text-zinc-700';

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 tracking-wide">
          {DIMENSION_LABELS[dim.dimension] ?? dim.dimension}
        </h2>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${scoreStyle}`}>
          {dim.score}/5
        </span>
      </div>

      <ScoreDots score={dim.score} />

      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
        Observation
      </p>
      <p className="text-sm text-zinc-700 leading-relaxed mb-4">{dim.observation}</p>

      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Fix</p>
      <p className="text-sm text-zinc-700 leading-relaxed">{dim.fix}</p>
    </div>
  );
}

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: recording } = await supabase
    .from('recordings')
    .select('id, status, error_reason')
    .eq('id', id)
    .single();

  if (!recording) notFound();

  const { data: reportRow } = await supabase
    .from('reports')
    .select('payload')
    .eq('recording_id', id)
    .maybeSingle();

  const report = reportRow?.payload as Report | null;

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/recordings"
            className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            &larr; All recordings
          </Link>
        </div>

        {recording.status === 'failed' && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
            <h1 className="text-lg font-semibold text-zinc-900 mb-2">Analysis failed</h1>
            {recording.error_reason && (
              <p className="text-sm text-zinc-500 mb-4">{recording.error_reason}</p>
            )}
            <Link
              href="/upload"
              className="inline-block bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Try again
            </Link>
          </div>
        )}

        {(recording.status === 'analyzing' || recording.status === 'pending') && !report && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 mb-4" />
            <p className="text-sm text-zinc-600">Analyzing your video...</p>
          </div>
        )}

        {report && (
          <>
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
                    Your Presentation Feedback
                  </h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    {report.dimensions.length} dimension
                    {report.dimensions.length !== 1 ? 's' : ''}, scored 1&ndash;5
                  </p>
                </div>
                {report.partial && (
                  <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-lg">
                    Partial report
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.dimensions.map((dim) => (
                <DimensionCard key={dim.dimension} dim={dim} />
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/upload"
                className="inline-block bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Analyze another video
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
