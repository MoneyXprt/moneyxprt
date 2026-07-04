import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { evaluateAll } from '@/app/lib/strategies/registry';
import { getSnapshotForServer } from '@/app/lib/snapshots';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface CpaReportData {
  taxpayerSummary: {
    filingStatus: string;
    state: string;
    taxYear: number;
    estimatedAGI: number;
    email: string;
  };
  implementedStrategies: Array<{
    name: string;
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

  const [snapshot, actionsResult, repsLogsResult] = await Promise.all([
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
  ]);

  if (!snapshot) throw new Error('No financial snapshot found for this user.');

  const allStrategies    = evaluateAll(snapshot);
  const completedActions = actionsResult.data ?? [];
  const repsLogs         = repsLogsResult.data ?? [];

  // ── Implemented strategies ────────────────────────────────────────────────

  const implementedStrategies = completedActions.map(action => {
    const strategyId     = (action.strategy_id as string) ?? '';
    const strategyResult = allStrategies.find(s => s.id === strategyId);
    return {
      name: strategyResult?.name ?? (action.title as string),
      ircSection: IRC_SECTIONS[strategyId] ?? '',
      estimatedAnnualValue: Number(action.estimated_annual_value ?? strategyResult?.estimatedAnnualValue ?? 0),
      description: strategyResult?.reason ?? (action.description as string) ?? '',
      documentationRequired:
        DOCUMENTATION_REQUIREMENTS[strategyId] ?? DOCUMENTATION_REQUIREMENTS['__fallback__'],
      dateImplemented: action.completed_at
        ? new Date(action.completed_at as string).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })
        : '',
    };
  });

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
