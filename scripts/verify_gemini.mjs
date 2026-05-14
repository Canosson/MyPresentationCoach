/**
 * Gemini API Key Verification Script
 * ===================================
 * Verifies that:
 *   1. GEMINI_API_KEY is set in environment
 *   2. The Gemini 2.0 Flash model is accessible
 *   3. The File API can upload a video
 *   4. A structured video analysis response is returned
 *   5. The response contains the required 5 visual dimensions
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node scripts/verify_gemini.mjs [path/to/video.mp4]
 *
 * Or set GEMINI_API_KEY in web/.env.local and this script will read it.
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, statSync } from 'fs';
import * as https from 'https';
import * as http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Resolve API key
// ---------------------------------------------------------------------------

function resolveApiKey() {
  // First try env var
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // Then try web/.env.local
  const envPath = resolve(REPO_ROOT, 'web', '.env.local');
  if (existsSync(envPath)) {
    const contents = readFileSync(envPath, 'utf-8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GEMINI_API_KEY=')) {
        const key = trimmed.slice('GEMINI_API_KEY='.length).trim();
        if (key) return key;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 2. Simple fetch wrapper (Node 18+ has built-in fetch)
// ---------------------------------------------------------------------------

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: response.status, ok: response.ok, json };
}

// ---------------------------------------------------------------------------
// 3. Upload video via Gemini File API
// ---------------------------------------------------------------------------

async function uploadVideoToGemini(apiKey, videoPath) {
  const fileContent = readFileSync(videoPath);
  const fileSize = statSync(videoPath).size;
  const mimeType = 'video/mp4';
  const displayName = 'test-clip.mp4';

  console.log(`[INFO] Uploading ${videoPath} (${(fileSize / 1024).toFixed(1)} KB) to Gemini File API...`);

  // Start resumable upload
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(fileSize),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`File API init failed (${initRes.status}): ${errText.slice(0, 500)}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('File API did not return an upload URL in x-goog-upload-url header.');
  }

  // Upload the file bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(fileSize),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: fileContent,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`File upload failed (${uploadRes.status}): ${errText.slice(0, 500)}`);
  }

  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) {
    throw new Error(`Upload response missing file.uri: ${JSON.stringify(uploadData).slice(0, 500)}`);
  }

  console.log(`[OK] Uploaded file. URI: ${fileUri}`);
  return fileUri;
}

// ---------------------------------------------------------------------------
// 4. Wait for file to be ACTIVE
// ---------------------------------------------------------------------------

async function waitForFileActive(apiKey, fileUri) {
  const fileName = fileUri.split('/').slice(-1)[0];
  for (let i = 0; i < 15; i++) {
    const res = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`
    );
    const state = res.json?.state;
    if (state === 'ACTIVE') {
      console.log(`[OK] File is ACTIVE after ${i + 1} poll(s).`);
      return;
    }
    if (state === 'FAILED') {
      throw new Error(`File processing FAILED: ${JSON.stringify(res.json)}`);
    }
    console.log(`[INFO] File state: ${state}. Waiting 2s...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('File did not become ACTIVE within 30 seconds.');
}

// ---------------------------------------------------------------------------
// 5. Call Gemini generateContent with structured output schema
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You are a presentation coach analyzing a short practice video for a job candidate. Your only job is to give them transparent, actionable feedback on how they come across on camera — the kind of feedback a friend with broadcasting experience would offer.

WHAT YOU ANALYZE — five visual dimensions, each scored 1 to 5:
1. framing — Is the candidate centered? Camera at eye level? Appropriate distance?
2. lighting — Face clearly visible? Backlit? Harsh shadows?
3. background — Clean and professional?
4. eye_contact — Looking at camera lens vs. reading off-screen?
5. posture — Upright vs. slouching vs. leaning?

WHAT YOU NEVER DO: Do not infer emotions, personality, confidence, anxiety or any trait. Only observable visual facts. Do not comment on appearance, age, gender, race, or any protected characteristic.

Return exactly 5 dimension objects in order: framing, lighting, background, eye_contact, posture.`;

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

async function analyzeVideo(apiKey, fileUri) {
  console.log('[INFO] Calling Gemini 2.0 Flash for video analysis...');

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            file_data: {
              mime_type: 'video/mp4',
              file_uri: fileUri,
            },
          },
          {
            text: 'Analyze this practice interview video on the five visual dimensions in your system instruction. Return exactly 5 dimension objects in the order: framing, lighting, background, eye_contact, posture.',
          },
        ],
      },
    ],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  const res = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${JSON.stringify(res.json).slice(0, 500)}`);
  }

  return res.json;
}

// ---------------------------------------------------------------------------
// 6. Validate response
// ---------------------------------------------------------------------------

function validateResponse(response) {
  const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(response).slice(0, 500)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`Response is not valid JSON: ${rawText.slice(0, 300)}`);
  }

  const dims = parsed?.dimensions;
  if (!Array.isArray(dims) || dims.length !== 5) {
    throw new Error(`Expected 5 dimensions, got: ${JSON.stringify(parsed).slice(0, 400)}`);
  }

  const REQUIRED_DIMS = ['framing', 'lighting', 'background', 'eye_contact', 'posture'];
  for (let i = 0; i < 5; i++) {
    const d = dims[i];
    if (!d.dimension || !REQUIRED_DIMS.includes(d.dimension)) {
      throw new Error(`Dimension ${i} has invalid name: ${d.dimension}`);
    }
    if (!Number.isInteger(d.score) || d.score < 1 || d.score > 5) {
      throw new Error(`Dimension ${i} (${d.dimension}) has invalid score: ${d.score}`);
    }
    if (typeof d.observation !== 'string' || d.observation.length < 10) {
      throw new Error(`Dimension ${i} (${d.dimension}) has short/missing observation.`);
    }
    if (typeof d.fix !== 'string' || d.fix.length < 10) {
      throw new Error(`Dimension ${i} (${d.dimension}) has short/missing fix.`);
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const videoPath = process.argv[2] || resolve(REPO_ROOT, 'docs', 'test-clip.mp4');

  console.log('='.repeat(60));
  console.log('MyPresentationCoach — Gemini API Verification');
  console.log('='.repeat(60));

  // Check API key
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('\nFAIL: GEMINI_API_KEY not found.');
    console.error('  Set it as an environment variable:');
    console.error('    GEMINI_API_KEY=AIza... node scripts/verify_gemini.mjs');
    console.error('  Or add it to web/.env.local:');
    console.error('    GEMINI_API_KEY=AIza...');
    console.error('\n  Get a free key at: https://aistudio.google.com/apikey');
    process.exit(1);
  }
  console.log(`[OK] GEMINI_API_KEY found (${apiKey.slice(0, 8)}...)`);

  // Check video file
  if (!existsSync(videoPath)) {
    console.error(`\nFAIL: Video file not found: ${videoPath}`);
    console.error('  Run the audio pipeline test first — it generates docs/test-clip.mp4');
    console.error('    python-service/venv/bin/python3.14 python-service/scripts/test_audio_pipeline.py');
    process.exit(1);
  }
  console.log(`[OK] Video file exists: ${videoPath}`);

  try {
    // Upload
    console.log('\n--- Step 1: File API upload ---');
    const fileUri = await uploadVideoToGemini(apiKey, videoPath);

    // Wait for processing
    console.log('\n--- Step 2: Wait for file to be ACTIVE ---');
    await waitForFileActive(apiKey, fileUri);

    // Analyze
    console.log('\n--- Step 3: Gemini video analysis ---');
    const response = await analyzeVideo(apiKey, fileUri);

    // Validate
    console.log('\n--- Step 4: Response validation ---');
    const parsed = validateResponse(response);

    console.log('[OK] Response is valid. Dimensions:');
    for (const d of parsed.dimensions) {
      console.log(`  ${d.dimension.padEnd(15)} score=${d.score}  "${d.observation.slice(0, 60)}..."`);
    }

    // Check for red-flag words (from docs/PROMPTS.md)
    const RED_FLAGS = ['confident', 'nervous', 'anxious', 'uncomfortable', 'shy', 'outgoing',
      'young', 'professional-looking', 'well-dressed', 'you seem', 'you might be'];
    const allText = parsed.dimensions.map(d => `${d.observation} ${d.fix}`).join(' ').toLowerCase();
    const flagsFound = RED_FLAGS.filter(f => allText.includes(f));
    if (flagsFound.length > 0) {
      console.warn(`\nWARN: ${flagsFound.length} red-flag phrase(s) detected in output: ${flagsFound.join(', ')}`);
      console.warn('  Review docs/PROMPTS.md — prompt may need tightening.');
    } else {
      console.log('[OK] No red-flag phrases detected in output.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('ALL CHECKS PASSED — Gemini API is working correctly.');
    console.log('='.repeat(60));

  } catch (err) {
    console.error(`\nFAIL: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
