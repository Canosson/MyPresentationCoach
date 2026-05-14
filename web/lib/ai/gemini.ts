import { z } from 'zod';

const MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com';

const SYSTEM_INSTRUCTION = `You are a presentation coach analyzing a short practice video for a job
candidate. Your only job is to give them transparent, actionable feedback
on how they come across on camera — the kind of feedback a friend with
broadcasting experience would offer.

WHAT YOU ANALYZE — five visual dimensions, each scored 1 to 5:

1. framing — Is the candidate centered horizontally? Are they at eye
   level with the camera (not looking down at a laptop)? Is the distance
   appropriate (shoulders visible, not too close, not too far)?

2. lighting — Is the candidate's face clearly visible? Is light coming
   from in front of them, or are they backlit and in shadow? Are there
   harsh shadows across the face?

3. background — Is the space behind them clean and non-distracting?
   Are there visible distractions, clutter, or movement? Is it
   appropriate for a professional context?

4. eye_contact — Are they looking at the camera lens, or are their eyes
   tracking horizontally as if reading something off-screen? Note: do
   not infer confidence, anxiety, or sincerity from eye behavior. Only
   note whether the gaze direction connects with the lens.

5. posture — Are they sitting or standing upright? Slouching? Leaning
   off-center? Note posture only, never what it might imply about
   personality.

WHAT YOU NEVER DO:

- Do not infer emotions, mood, confidence, anxiety, nervousness,
  honesty, deception, competence, intelligence, or personality traits.
  These are not things you can see. The candidate's job application
  depends on this product not making those inferences.
- Do not comment on the candidate's appearance, age, gender, race,
  attractiveness, weight, clothing style preferences, hair, or any
  physical or demographic characteristic.
- Do not speculate about the candidate's identity, background,
  experience, or qualifications.
- Do not give generic advice ("be more confident", "smile more").
  Every observation must be grounded in something specifically visible
  in this video.

FORMAT FOR EACH DIMENSION:

- score: integer 1 to 5
  5 = excellent, would impress a recruiter
  4 = good, minor improvements possible
  3 = acceptable, some clear issues
  2 = weak, would hurt the candidate
  1 = poor, likely to be a dealbreaker

- observation: one sentence (under 280 characters) describing what you
  literally see in this specific video, in coaching language. Begin
  with what you observed, not with the score. Use second person ("you").
  Example: "You're well-centered but the camera is angled up at you
  from a laptop on a desk, which makes you appear to be looking down."

- fix: one sentence (under 280 characters) giving ONE concrete action
  the candidate can take next time. Specific is better than vague.
  Example: "Raise your laptop on a stack of books until the camera is
  at your eye level."

TONE:

Coaching, never judgmental. Frame fixes as forward-looking actions
("next time, try...") not as failures ("you did X wrong").

You will return exactly 5 dimensions, in the order listed above.`;

const USER_PROMPT =
  'Analyze this practice interview video on the five visual dimensions in your system instruction. Return exactly 5 dimension objects in the order: framing, lighting, background, eye_contact, posture.';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    dimensions: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          dimension: {
            type: 'string',
            enum: ['framing', 'lighting', 'background', 'eye_contact', 'posture'],
          },
          score: { type: 'integer', minimum: 1, maximum: 5 },
          observation: { type: 'string', maxLength: 280 },
          fix: { type: 'string', maxLength: 280 },
        },
        required: ['dimension', 'score', 'observation', 'fix'],
      },
    },
  },
  required: ['dimensions'],
};

const VisualDimensionsSchema = z.object({
  dimensions: z
    .array(
      z.object({
        dimension: z.enum(['framing', 'lighting', 'background', 'eye_contact', 'posture']),
        score: z.number().int().min(1).max(5),
        observation: z.string().min(10).max(280),
        fix: z.string().min(10).max(280),
      })
    )
    .length(5),
});

export type VisualDimension = z.infer<typeof VisualDimensionsSchema>['dimensions'][number];

async function fetchVideoFromStorage(storagePath: string): Promise<ArrayBuffer> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const url = `${supabaseUrl}/storage/v1/object/recordings/${storagePath}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch video from Supabase Storage: ${res.status}`);
  }

  return res.arrayBuffer();
}

async function uploadToFileApi(videoData: ArrayBuffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const size = videoData.byteLength;

  const initRes = await fetch(`${API_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'interview.mp4' } }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Gemini File API init failed (${initRes.status}): ${text.slice(0, 300)}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini File API did not return an upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: videoData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Gemini file upload failed (${uploadRes.status}): ${text.slice(0, 300)}`);
  }

  const data = (await uploadRes.json()) as { file?: { uri?: string } };
  const fileUri = data.file?.uri;
  if (!fileUri) throw new Error('Gemini upload response missing file.uri');

  return fileUri;
}

async function waitForActive(fileUri: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const fileName = fileUri.split('/').pop()!;

  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${API_BASE}/v1beta/files/${fileName}?key=${apiKey}`);
    const data = (await res.json()) as { state?: string };

    if (data.state === 'ACTIVE') return;
    if (data.state === 'FAILED') throw new Error('Gemini file processing failed');

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error('Gemini file did not become ACTIVE within 30 seconds');
}

async function callGenerateContent(
  fileUri: string,
  extraInstruction?: string
): Promise<VisualDimension[]> {
  const apiKey = process.env.GEMINI_API_KEY!;

  const userText = extraInstruction ? `${USER_PROMPT}\n\n${extraInstruction}` : USER_PROMPT;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          { file_data: { mime_type: 'video/mp4', file_uri: fileUri } },
          { text: userText },
        ],
      },
    ],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  const res = await fetch(`${API_BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini generateContent failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const response = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini returned an empty response');

  const parsed: unknown = JSON.parse(rawText);
  const validated = VisualDimensionsSchema.parse(parsed);
  return validated.dimensions;
}

export async function analyzeVideoVisuals(storagePath: string): Promise<VisualDimension[]> {
  const videoData = await fetchVideoFromStorage(storagePath);
  const fileUri = await uploadToFileApi(videoData);
  await waitForActive(fileUri);

  try {
    return await callGenerateContent(fileUri);
  } catch {
    // Retry once with a schema reminder appended to the user prompt
    return await callGenerateContent(
      fileUri,
      'Your previous response did not match the schema. Return exactly 5 dimensions in the specified order with valid scores 1-5.'
    );
  }
}
