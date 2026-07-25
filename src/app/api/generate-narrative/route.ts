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
    phases, assetRoadmap, freedomType, targetFreeAge, totalActiveDebt,
    projectedTaxStrategyAnnualValue,
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

  // The model is never otherwise told what "today" is, so left to itself it has to
  // infer "X years away" phrasing from the absolute calendarYear values above — an
  // ungrounded guess, not a calculation. Compute it here and hand over the exact
  // number instead.
  const currentYear = new Date().getFullYear();
  const yearsUntilFreedom = projectedFreedomYear - currentYear;

  return `Here is a financial plan summary for a high-income W2 earner. Write a 3-paragraph plain-language summary in CFO voice.

THEIR VISION:
"${freedomVision || 'Financial freedom — working only when they choose to.'}"

Their goal: ${freedomTypeLabel}, target age ${targetFreeAge}.

KEY NUMBERS:
- Current year: ${currentYear}
- Freedom number (monthly passive income needed): $${Math.round(freedomNumber).toLocaleString()}/mo
- Current passive income: $${Math.round(currentPassiveIncome).toLocaleString()}/mo
- Monthly gap to close: $${Math.round(gapMonthly).toLocaleString()}/mo
- Projected year of freedom: ${projectedFreedomYear} (exactly ${yearsUntilFreedom} year${yearsUntilFreedom === 1 ? '' : 's'} from now)
- Deployable capital per year (after tax savings): $${Math.round(deployableCapitalPerYear).toLocaleString()}
- Annual CASH tax savings identified (real dollars redirected to deployable capital this year): $${Math.round(taxStrategyAnnualValue).toLocaleString()}${
    projectedTaxStrategyAnnualValue && projectedTaxStrategyAnnualValue > 0
      ? `\n- Projected long-term value from tax-advantaged strategies (e.g. Backdoor Roth — NOT cash-in-hand this year, it's future tax-free growth): $${Math.round(projectedTaxStrategyAnnualValue).toLocaleString()}/yr`
      : ''
  }${
    totalActiveDebt && totalActiveDebt > 0
      ? `\n- Total current debt balance (today, across all active debts): $${Math.round(totalActiveDebt).toLocaleString()}`
      : ''
  }

PLAN PHASES:
${topPhases}

FIRST 5 YEARS OF ASSET ROADMAP:
${roadmapSummary}
${
  totalActiveDebt && totalActiveDebt > 0
    ? `\nNote: the roadmap lines above show the debt balance REMAINING after each year's paydown — they are NOT the current total. The current total debt balance today is the "$${Math.round(totalActiveDebt).toLocaleString()}" figure in KEY NUMBERS. Never state a "remaining" figure from the roadmap as if it were the current total debt.`
    : ''
}${
  projectedTaxStrategyAnnualValue && projectedTaxStrategyAnnualValue > 0
    ? `\nNote: cash tax savings and projected long-term value are NOT the same thing and must not be combined into one number or described interchangeably. Cash tax savings are real dollars available this year to redirect toward assets. Projected long-term value (e.g. Backdoor Roth) is future tax-free growth, not cash available now. If you mention both, name them separately — e.g. "$X in cash tax savings this year, plus $Y in projected long-term value from tax-advantaged accounts" — never state a single flat "$Z in tax savings" figure that blends the two.`
    : ''
}

Note: whenever you state how many years away their freedom year is, use the exact
"${yearsUntilFreedom} years from now" figure given in KEY NUMBERS — do not infer or
calculate it yourself from the calendar years, and do not round it.

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
  totalActiveDebt?: number;
  projectedTaxStrategyAnnualValue?: number;
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
