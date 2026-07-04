import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
  let body: StatementBody;
  try {
    body = await req.json() as StatementBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
    return NextResponse.json({ freedom_statement: buildFallback(body!) });
  }
}
