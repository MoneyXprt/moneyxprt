import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface StatementBody {
  childhood_dream:       string;
  vision_text:           string;
  identity_shift:        string;
  relationship_impact:   string;
  time_use_preference:   string;
  cost_of_waiting:       string;
  target_free_age:       number;
}

function isStatementBody(value: unknown): value is StatementBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  const textFields = [
    'childhood_dream', 'vision_text', 'identity_shift', 'relationship_impact',
    'time_use_preference', 'cost_of_waiting',
  ];
  return textFields.every((field) => typeof body[field] === 'string' && body[field].length <= 2_000)
    && typeof body.target_free_age === 'number'
    && Number.isInteger(body.target_free_age)
    && body.target_free_age >= 18
    && body.target_free_age <= 100;
}

function buildFallback(b: StatementBody): string {
  const visionClue = b.vision_text
    ? b.vision_text.split('.')[0].trim()
    : 'a different kind of life';
  return `You're building toward ${visionClue}. By age ${b.target_free_age}, you want ${b.time_use_preference.toLowerCase()} to be possible — not someday, but as the actual shape of your days.`;
}

const SYSTEM_PROMPT =
  "You are writing a short, powerful personal statement for someone building a financial freedom plan. " +
  "Synthesize their answers into 2-3 sentences written in second person ('You're building toward...'). " +
  "Use specific, concrete details from their answers — not generic language. " +
  "The tone is warm but grounded, like a wise friend reflecting their own dream back to them. " +
  "No cheesy motivational language. No exclamation points. " +
  "Make it feel true, not inspirational-poster.";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user } } = await authClient.auth.getUser(authHeader.slice(7));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkServerRateLimit(
    `generate-freedom-statement:${user.id}`,
    { maxRequests: 8, windowMs: 600_000 },
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isStatementBody(payload)) {
    return NextResponse.json({ error: 'Invalid freedom statement request.' }, { status: 400 });
  }
  const body = payload;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Childhood dream: "${body.childhood_dream || 'not provided'}"`,
            `Vision of a perfect free Tuesday: "${body.vision_text || 'not provided'}"`,
            `Who they become when free: "${body.identity_shift || 'not provided'}"`,
            `Impact on relationships: "${body.relationship_impact || 'not provided'}"`,
            `How they'd spend time: "${body.time_use_preference || 'not provided'}"`,
            `What they're missing right now: "${body.cost_of_waiting || 'not provided'}"`,
            `Target free age: ${body.target_free_age}`,
            '',
            'Write a 2-3 sentence personal freedom statement in second person that synthesizes these answers into something that feels true and specific to this person.',
          ].join('\n'),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response');

    return NextResponse.json({ freedom_statement: text });
  } catch (err) {
    console.error('[generate-freedom-statement]', err);
    return NextResponse.json({ freedom_statement: buildFallback(body) });
  }
}
