import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

// Prevent Next.js from statically pre-rendering this dynamic API route at build time.
export const dynamic = 'force-dynamic';

// Lazy singleton — avoids build-time failures when env vars aren't present.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Shape returned by Claude after parsing the raw voice log.
 */
interface ParsedLog {
  hours_logged: number;
  description: string;
  irs_category: string;
  date: string; // ISO 8601 date string (YYYY-MM-DD)
}

/**
 * IRS-recognized categories for material participation under
 * Reg. §1.469-5T and the seven material-participation tests.
 */
const IRS_CATEGORIES = [
  'Significant participation activity',
  'Real estate professional activity',
  'Active management – rental real estate',
  'Substantially all participation',
  'More than 100 hours – no other participant exceeds',
  'More than 500 hours',
  'Personal service activity',
  'Historical material participation (5 of prior 10 years)',
  'Historical material participation – personal service (any 3 prior years)',
  'Other – document separately',
] as const;

const SYSTEM_PROMPT = `You are an AI assistant specialized in U.S. tax law, specifically IRS rules around material participation (Reg. §1.469-5T) for W-2 wage earners with real estate or business activities.

Your job is to parse a raw voice log entry from a taxpayer and return a single JSON object with exactly these fields:
- "hours_logged": a positive decimal number (e.g. 2.5) representing hours spent on the activity. If ambiguous, make a conservative estimate.
- "description": a concise, professional summary (1-3 sentences) suitable for an IRS audit. Focus on what was done, the business purpose, and which property or activity was involved.
- "irs_category": one of the following exact strings (choose the most applicable):
  ${IRS_CATEGORIES.map((c) => `"${c}"`).join('\n  ')}
- "date": the ISO 8601 date (YYYY-MM-DD) the activity occurred. If the user says "today", use today's date. If no date is mentioned, use today's date.

Rules:
- Respond with ONLY the raw JSON object — no markdown fences, no commentary.
- hours_logged must be a number, not a string.
- Be conservative with hours if the count is unclear.
- The description must be audit-defensible and professional; rewrite colloquial language.`;

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    // Validate the JWT with the anon-key client so we can get the user's id
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = await checkServerRateLimit(
      `parse-voice-log:${user.id}`,
      { maxRequests: 20, windowMs: 600_000 },
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    // ── Request body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const rawLog: string | undefined = body?.raw_log;

    if (!rawLog || typeof rawLog !== 'string' || rawLog.trim().length === 0) {
      return NextResponse.json(
        { error: '`raw_log` (non-empty string) is required in the request body' },
        { status: 400 },
      );
    }

    if (rawLog.length > 4000) {
      return NextResponse.json(
        { error: '`raw_log` must be 4000 characters or fewer' },
        { status: 400 },
      );
    }

    // ── OpenAI parse ──────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Today's date is ${today}.\n\nVoice log:\n${rawLog.trim()}`,
        },
      ],
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      return NextResponse.json({ error: 'Unexpected response from AI parser' }, { status: 502 });
    }

    let parsed: ParsedLog;
    try {
      parsed = JSON.parse(rawText) as ParsedLog;
    } catch {
      return NextResponse.json(
        { error: 'AI parser returned invalid JSON', raw: rawText },
        { status: 502 },
      );
    }

    // ── Validate the parsed payload ───────────────────────────────────────────
    const validationErrors: string[] = [];

    if (typeof parsed.hours_logged !== 'number' || parsed.hours_logged <= 0) {
      validationErrors.push('`hours_logged` must be a positive number');
    }
    if (parsed.hours_logged > 24) {
      validationErrors.push('`hours_logged` cannot exceed 24 hours in a single day');
    }
    if (typeof parsed.description !== 'string' || parsed.description.trim().length < 10) {
      validationErrors.push('`description` must be a non-empty string of at least 10 characters');
    }
    if (!IRS_CATEGORIES.includes(parsed.irs_category as typeof IRS_CATEGORIES[number])) {
      validationErrors.push(`\`irs_category\` must be one of the recognized IRS categories`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      validationErrors.push('`date` must be a valid ISO 8601 date (YYYY-MM-DD)');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: validationErrors }, { status: 422 });
    }

    // ── Insert into Supabase ──────────────────────────────────────────────────
    const serverClient = createServerSupabaseClient();
    const { data: inserted, error: dbError } = await serverClient
      .from('material_participation_logs')
      .insert({
        user_id: user.id,
        date: parsed.date,
        hours_logged: parsed.hours_logged,
        description: parsed.description.trim(),
        irs_category: parsed.irs_category,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[parse-voice-log] DB insert error:', dbError);
      return NextResponse.json({ error: 'Could not save your voice log. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, log: inserted }, { status: 201 });
  } catch (err) {
    console.error('[parse-voice-log] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
