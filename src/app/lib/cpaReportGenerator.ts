import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { evaluateAll } from '@/app/lib/strategies/registry';
import { getSnapshotForServer } from '@/app/lib/snapshots';
import { loadTaxConstantsByYear } from '@/app/lib/taxConstantsByYearRepository';
import { computeGrossAnnualIncome } from '@/app/lib/deployableCapital';
import { simulateDebtSnowballPayoff, type SimulatableDebt } from '@/app/lib/debtPayoff';
import type { FinancialPhase } from '@/app/lib/financialPhase';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface CpaReportData {
  taxpayerSummary: {
    filingStatus: string;
    state: string;
    taxYear: number;
    estimatedAGI: number;
    email: string;
  };
  // Snapshot-level facts + the plan already generated/saved elsewhere — not
  // recomputed here, just surfaced for the CPA's context. See buildCpaReportData
  // for exactly where each figure is sourced from.
  financialBaseline: {
    w2Income: number;
    /** Calendar year debt is projected debt-free, or null if not in a debt-payoff phase / no active debt. */
    debtFreeYear: number | null;
    /** Freedom number, $/month — null if no plan has been generated yet. */
    freedomNumberMonthly: number | null;
    /** Calendar year the freedom number is projected to be reached — null if no plan. */
    targetFreedomYear: number | null;
    effectiveTaxRate: number;
    taxPaidLastYear: number;
  };
  implementedStrategies: Array<{
    name: string;
    category: string;
    ircSection: string;
    estimatedAnnualValue: number;
    description: string;
    documentationRequired: string;
    dateImplemented: string;
  }>;
  repsSummary: {
    totalHoursLoggedYTD: number;
    monthlyBreakdown: Array<{ month: string; hours: number }>;
    activityLog: Array<{ date: string; hours: number; description: string; category: string }>;
    meetsRequirement: boolean;
  };
  totalEstimatedSavings: number;
}

// ─── Strategy category → section title (Implemented Strategies grouping) ──────
// Grouped by each strategy's static category rather than planGenerator.ts's live
// phase-number assignment — a strategy's phase can shift over time (roadmap-
// dependent), same historical-accuracy problem already fixed for descriptions
// above; category is fixed per strategy and never changes with snapshot inputs.
export const CATEGORY_TITLES: Record<string, string> = {
  tax:                'Tax Strategies',
  retirement:         'Retirement Strategies',
  realEstate:         'Real Estate Strategies',
  businessStructure:  'Business Structure Strategies',
  debt:               'Debt Strategies',
  investment:         'Investment Strategies',
  family:             'Family Strategies',
  other:              'Other Strategies',
};

// ─── IRC section lookup (by strategy id) ─────────────────────────────────────

const IRC_SECTIONS: Record<string, string> = {
  'augusta-rule':        '§280A(g)',
  'solo-k':              '§401(a), §415',
  'backdoor-roth':       '§408A',
  'hsa':                 '§223',
  's-corp-election':     '§1362',
  'qbi':                 '§199A',
  'accountable-plan':    '§62(a)(2)',
  'depreciation':        '§168, §469(c)(7)',
  'hire-kids':           '§3121(b)(3)',
  'mega-backdoor-roth':  '§401(a)(31)',
  'reps':                '§469(c)(7)',
  'home-office-deduction': '§280A(c)',
  'startup-costs':         '§195',
  'section-179-vehicle':   '§179',
};

// ─── Documentation requirements per strategy ──────────────────────────────────

const DOCUMENTATION_REQUIREMENTS: Record<string, string> = {
  'augusta-rule':
    'Written rental agreement between taxpayer and business entity. Documentation of fair market ' +
    'rate (comparable venue rates). Meeting agenda, attendee list, and business purpose for each ' +
    'rental day. Retain for 7 years.',

  'solo-k':
    'Plan adoption agreement. Contribution records showing employee deferral and employer match ' +
    'calculations. Form 5500-EZ if plan assets exceed $250,000.',

  'depreciation':
    'Closing statement showing purchase price allocation. Cost segregation study if applicable. ' +
    'Depreciation schedule (Form 4562). REPS hour logs if claiming non-passive treatment.',

  'backdoor-roth':
    'Form 8606 for nondeductible contribution. Conversion confirmation from custodian. ' +
    'Pro-rata calculation if other pre-tax IRA balances exist.',

  'hire-kids':
    'W-2 issued to each child. Payroll records showing reasonable wages for actual work performed. ' +
    'Time/task records substantiating work performed.',

  'accountable-plan':
    'Written accountable plan document. Expense reports with receipts. Reimbursement records ' +
    'showing business purpose for each expense.',

  'qbi':
    'Schedule C, E, or K-1 showing qualified business income. Form 8995 or 8995-A depending on ' +
    'income level.',

  'hsa':
    'Form 8889. Confirmation of HDHP enrollment. Contribution records.',

  'mega-backdoor-roth':
    '401(k) plan document confirming after-tax contribution provision. In-service distribution or ' +
    'conversion records.',

  's-corp-election':
    'Form 2553. Reasonable salary documentation (comparable wage data). Payroll records.',

  'reps':
    'Contemporaneous time logs (this report). Documentation that real estate hours exceed 50% of ' +
    'total working hours and total 750+.',

  'home-office-deduction':
    'Photos of the dedicated space. Floor plan or measurement showing square footage. Note ' +
    'confirming the space is used regularly and exclusively for business — no personal use.',

  'startup-costs':
    'Itemized list of pre-opening expenses with dated receipts. Documentation of the date the ' +
    'business began active operations. Note: any amount beyond the $5,000 immediate deduction ' +
    'is amortized over 180 months (15 years) — track separately for future-year returns.',

  'section-179-vehicle':
    'Contemporaneous mileage log substantiating business-use percentage. Documentation of the ' +
    'calculation method used to arrive at that percentage. Vehicle purchase agreement/invoice ' +
    'showing price and in-service date. GVWR documentation (window sticker or manufacturer spec) ' +
    'confirming the vehicle exceeds 6,000 lbs.',

  '__fallback__':
    'Consult your tax professional for specific documentation requirements for this strategy.',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Data assembly ────────────────────────────────────────────────────────────

export async function buildCpaReportData(
  userId: string,
  userEmail: string,
): Promise<CpaReportData> {
  const sb = createServerSupabaseClient();
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd   = `${currentYear + 1}-01-01`;

  const [snapshot, actionsResult, repsLogsResult, planRowResult, debtsResult, phaseResult, strategyEvaluationContext] = await Promise.all([
    getSnapshotForServer(userId, sb),
    sb
      .from('execution_actions')
      .select('strategy_id, title, description, estimated_annual_value, completed_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .not('strategy_id', 'is', null)
      .order('completed_at'),
    sb
      .from('material_participation_logs')
      .select('date, hours_logged, description, irs_category')
      .eq('user_id', userId)
      .gte('date', yearStart)
      .lt('date', yearEnd)
      .order('date'),
    sb
      .from('generated_plans')
      .select('freedom_gap, deployable_capital_per_year')
      .eq('user_id', userId)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('debts')
      .select('id, name, current_balance, interest_rate, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    sb
      .from('financial_phase_status')
      .select('phase')
      .eq('user_id', userId)
      .maybeSingle(),
    loadTaxConstantsByYear(currentYear, sb),
  ]);

  if (!snapshot) throw new Error('No financial snapshot found for this user.');

  const allStrategies    = evaluateAll(snapshot, strategyEvaluationContext);
  const completedActions = actionsResult.data ?? [];
  const repsLogs         = repsLogsResult.data ?? [];

  // ── Implemented strategies ────────────────────────────────────────────────

  const implementedStrategies = completedActions.map(action => {
    const strategyId     = (action.strategy_id as string) ?? '';
    const strategyResult = allStrategies.find(s => s.id === strategyId);
    // Prefer the action's own stored description — the historically accurate text from
    // when the strategy was actually implemented — over strategyResult.reason, which is
    // re-evaluated against today's snapshot and can contradict a since-changed eligibility
    // state (e.g. "No business entity on file" for a strategy completed while one existed).
    // Only fall back to the live reason when nothing was stored at completion time.
    const actionDescription = ((action.description as string | null) ?? '').trim();
    return {
      name: strategyResult?.name ?? (action.title as string),
      // category (unlike phase/state) is fixed per strategy id and never changes with
      // snapshot inputs, so it's safe to read from today's evaluateAll() even though the
      // strategy may have been completed under different conditions — see CATEGORY_TITLES.
      category: strategyResult?.category ?? 'other',
      ircSection: IRC_SECTIONS[strategyId] ?? '',
      estimatedAnnualValue: Number(action.estimated_annual_value ?? strategyResult?.estimatedAnnualValue ?? 0),
      description: actionDescription !== '' ? actionDescription : (strategyResult?.reason ?? ''),
      documentationRequired:
        DOCUMENTATION_REQUIREMENTS[strategyId] ?? DOCUMENTATION_REQUIREMENTS['__fallback__'],
      dateImplemented: action.completed_at
        ? new Date(action.completed_at as string).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })
        : '',
    };
  });

  // ── Financial baseline & freedom plan ─────────────────────────────────────
  // Reads the plan already generated/saved on plan/results/page.tsx (freedom_gap,
  // deployable_capital_per_year) rather than re-deriving the full PlanInputs and
  // calling generateBaselinePlan again here — same numbers the user already sees on
  // Plan. Debt-free year is computed via the same simulateDebtSnowballPayoff planGenerator.ts
  // uses, fed the persisted deployable_capital_per_year, gated the same way (only in an
  // active debt-payoff phase, with active debts) rather than recomputing that gate.

  const freedomGap = planRowResult.data?.freedom_gap as
    { freedomNumberMonthly?: number; projectedFreedomYear?: number } | null | undefined;
  const freedomNumberMonthly = freedomGap?.freedomNumberMonthly ?? null;
  const targetFreedomYear    = freedomGap?.projectedFreedomYear  ?? null;

  const financialPhase = (phaseResult.data?.phase as FinancialPhase | undefined) ?? null;
  const isDebtPayoffPhase = financialPhase === 'funding_mini_ef' || financialPhase === 'paying_debt';
  const activeDebts: SimulatableDebt[] = (debtsResult.data ?? []).map(d => ({
    id:             d.id,
    name:           d.name,
    currentBalance: Number(d.current_balance),
    interestRate:   Number(d.interest_rate),
    isActive:       d.is_active,
  }));
  const deployableCapitalPerYear = Number(planRowResult.data?.deployable_capital_per_year ?? 0);
  const debtFreeYear = isDebtPayoffPhase && activeDebts.length > 0
    ? currentYear + simulateDebtSnowballPayoff(activeDebts, deployableCapitalPerYear).yearsToPayoff
    : null;

  const grossAnnualIncome = computeGrossAnnualIncome(snapshot);
  const effectiveTaxRate  = grossAnnualIncome > 0 ? snapshot.currentTaxPaid / grossAnnualIncome : 0;

  const financialBaseline = {
    w2Income:             snapshot.w2Income,
    debtFreeYear,
    freedomNumberMonthly,
    targetFreedomYear,
    effectiveTaxRate,
    taxPaidLastYear: snapshot.currentTaxPaid,
  };

  // ── REPS summary ──────────────────────────────────────────────────────────

  const totalHoursYTD = repsLogs.reduce(
    (sum, l) => sum + Number((l as { hours_logged: number }).hours_logged ?? 0),
    0,
  );

  const monthMap = new Map<number, number>();
  for (const log of repsLogs) {
    const m = new Date((log as { date: string }).date + 'T00:00:00').getMonth();
    monthMap.set(m, (monthMap.get(m) ?? 0) + Number((log as { hours_logged: number }).hours_logged));
  }

  const monthlyBreakdown = MONTHS
    .map((month, i) => ({ month, hours: monthMap.get(i) ?? 0 }))
    .filter(m => m.hours > 0);

  const activityLog = repsLogs.map(l => {
    const row = l as { date: string; hours_logged: number; description: string; irs_category: string };
    return {
      date: new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
      hours: Number(row.hours_logged),
      description: row.description,
      category: row.irs_category,
    };
  });

  // ── Estimated AGI ─────────────────────────────────────────────────────────

  const estimatedAGI =
    snapshot.w2Income +
    snapshot.bonusTakenAsCash +
    snapshot.income1099 +
    snapshot.carAllowanceAnnual +
    snapshot.otherIncomeAnnual +
    (snapshot.spouseWorks ? snapshot.spouseW2Income + snapshot.spouseBusinessRevenue : 0) +
    snapshot.businessRevenue +
    snapshot.monthlyRentalIncome   * 12 +
    snapshot.monthlyDividendIncome * 12;

  const totalEstimatedSavings = implementedStrategies.reduce(
    (sum, s) => sum + s.estimatedAnnualValue, 0,
  );

  return {
    taxpayerSummary: {
      filingStatus: snapshot.filingStatus === 'mfj' ? 'Married Filing Jointly' : 'Single',
      state:        snapshot.state,
      taxYear:      currentYear,
      estimatedAGI,
      email:        userEmail,
    },
    financialBaseline,
    implementedStrategies,
    repsSummary: {
      totalHoursLoggedYTD: totalHoursYTD,
      monthlyBreakdown,
      activityLog,
      meetsRequirement: totalHoursYTD >= 750,
    },
    totalEstimatedSavings,
  };
}
