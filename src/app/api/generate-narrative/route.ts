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

const SYSTEM_PROMPT =
  'You are a CFO advisor who helps high-income W2 earners build financial freedom. ' +
  'You write in a direct, honest, confident voice. No fluff, no cheerleading, no generic advice. ' +
  'You speak to sophisticated professionals who can handle the truth. ' +
  'You reference their specific numbers. ' +
  "You never say 'great', 'amazing', or 'absolutely'.";

function buildUserPrompt(body: NarrativeRequest): string {
  const {
    freedomVision, freedomNumber, currentPassiveIncome, gapMonthly,
    projectedFreedomYear, deployableCapitalPerYear, taxStrategyAnnualValue,
    phases, assetRoadmap, freedomType, targetFreeAge,
  } = body;

  const freedomTypeLabel =
    freedomType === 'never_work'   ? 'stop working entirely' :
    freedomType === 'work_optional'? 'make work optional'    :
                                     'reduce stress and change the work they do';

  const topPhases = phases.slice(0, 3).map(p =>
    `Phase ${p.number} — ${p.title}: ${p.actions.slice(0, 2).map(a => a.text).join('; ')}`
  ).join('\n');

  const roadmapSummary = assetRoadmap.slice(0, 5).map(r =>
    `Year ${r.year} (${r.calendarYear}): ${r.action} → total passive income $${Math.round(r.cumulativeMonthlyIncome).toLocaleString()}/mo`
  ).join('\n');

  return `Here is a financial plan summary for a high-income W2 earner. Write a 3-paragraph plain-language summary in CFO voice.

THEIR VISION:
"${freedomVision || 'Financial freedom — working only when they choose to.'}"

Their goal: ${freedomTypeLabel}, target age ${targetFreeAge}.

KEY NUMBERS:
- Freedom number (monthly passive income needed): $${Math.round(freedomNumber).toLocaleString()}/mo
- Current passive income: $${Math.round(currentPassiveIncome).toLocaleString()}/mo
- Monthly gap to close: $${Math.round(gapMonthly).toLocaleString()}/mo
- Projected year of freedom: ${projectedFreedomYear}
- Deployable capital per year (after tax savings): $${Math.round(deployableCapitalPerYear).toLocaleString()}
- Annual tax savings identified: $${Math.round(taxStrategyAnnualValue).toLocaleString()}

PLAN PHASES:
${topPhases}

FIRST 5 YEARS OF ASSET ROADMAP:
${roadmapSummary}

Write exactly 3 paragraphs. No headers, no bullets, no lists.
Paragraph 1: Their current situation — what the numbers actually mean and what the gap represents in real terms.
Paragraph 2: What this plan does and the specific mechanics of why it works given their numbers.
Paragraph 3: What they need to do first, why the order matters, and what happens if they execute it.
Be specific. Reference their actual numbers. Do not use generic financial advice language.`;
}

interface NarrativeRequest {
  freedomVision: string;
  freedomNumber: number;
  currentPassiveIncome: number;
  gapMonthly: number;
  projectedFreedomYear: number;
  deployableCapitalPerYear: number;
  taxStrategyAnnualValue: number;
  phases: { number: number; title: string; actions: { text: string }[] }[];
  assetRoadmap: { year: number; calendarYear: number; action: string; cumulativeMonthlyIncome: number }[];
  freedomType: string;
  targetFreeAge: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: NarrativeRequest = await req.json();

    // Trim roadmap to first 5 years on the server side as well
    body.assetRoadmap = body.assetRoadmap.slice(0, 5);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildUserPrompt(body) },
      ],
    });

    const narrative = completion.choices[0]?.message?.content?.trim() ?? null;
    return NextResponse.json({ narrative });
  } catch (err) {
    // Never block plan display — return null on any failure
    console.error('[generate-narrative] error:', err);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}
