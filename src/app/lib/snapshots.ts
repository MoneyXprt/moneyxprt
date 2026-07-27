import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';

// ─── DB row type ─────────────────────────────────────────────────────────────

export interface SnapshotRow {
  id: string;
  user_id: string;
  snapshot_date: string;
  created_at: string;
  // Income
  w2_income: number;
  bonus_income: number;
  bonus_deferred: number;
  bonus_taken_as_cash: number;
  income_1099: number;
  car_allowance_annual: number;
  other_income_annual: number;
  spouse_works: boolean;
  // Filing
  filing_status: string;
  state: string;
  dependents_under_18: number;
  dependent_ages: string;
  // Primary business
  has_business_entity: boolean;
  business_revenue: number;
  primary_business_net_profit: number;
  primary_business_type: string;
  primary_hours_per_week_in_business: number;
  // Spouse
  spouse_w2_income: number;
  spouse_business_revenue: number;
  spouse_business_net_profit: number;
  spouse_business_type: string;
  spouse_hours_per_week_in_business: number;
  // Tax
  current_tax_paid: number;
  has_hsa_available: boolean;
  has_cpa: boolean;
  cpa_proactive: boolean;
  // Balance sheet
  primary_residence_value: number;
  mortgage_balance: number;
  home_equity: number;
  currently_owns_rental: boolean;
  rental_property_value: number;
  rental_mortgage_balance: number;
  retirement_balance: number;
  traditional_ira_balance: number;
  taxable_brokerage_balance: number;
  business_equity_value: number;
  // Monthly flows
  monthly_rental_income: number;
  monthly_dividend_income: number;
  essential_monthly_spend: number;
  discretionary_monthly_spend: number;
  monthly_spend: number;
  emergency_fund: number;
  extra_debt_payments: number;
  child_support_monthly: number | null;
  alimony_monthly: number | null;
  // Liabilities
  car_loan_balance: number;
  car_loan_rate: number;
  car_loan_payment: number;
  student_loan_balance: number;
  student_loan_rate: number;
  student_loan_payment: number;
  personal_loan_balance: number;
  personal_loan_rate: number;
  personal_loan_payment: number;
  credit_card_balance: number;
  credit_card_rate: number;
  credit_card_payment: number;
  business_loan_balance: number;
  business_loan_rate: number;
  business_loan_payment: number;
  other_debt_label: string;
  other_debt_balance: number;
  other_debt_rate: number;
  other_debt_payment: number;
  // Retirement plan
  employer_401k_allows_after_tax: boolean | null;
  // Phase 2 / future (preserved for plan generator)
  considering_real_estate: boolean;
  planned_property_value: number | null;
  reps_qualified: boolean | null;
  excluded_strategy_ids: string | null;      // JSON array text, e.g. '["depreciation","reps"]'
  target_acquisition_timeframe: string | null;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toRow(
  userId: string,
  s: FinancialSnapshot,
): Omit<SnapshotRow, 'id' | 'snapshot_date' | 'created_at'> {
  return {
    user_id:                       userId,
    w2_income:                     s.w2Income,
    bonus_income:                  s.bonusIncome,
    bonus_deferred:                s.bonusDeferred,
    bonus_taken_as_cash:           s.bonusTakenAsCash,
    income_1099:                   s.income1099,
    car_allowance_annual:          s.carAllowanceAnnual,
    other_income_annual:           s.otherIncomeAnnual,
    spouse_works:                  s.spouseWorks,
    filing_status:                 s.filingStatus,
    state:                         s.state,
    dependents_under_18:           s.dependentsUnder18,
    dependent_ages:                s.dependentAges,
    has_business_entity:                s.hasBusinessEntity,
    business_revenue:                   s.businessRevenue,
    primary_business_net_profit:        s.primaryBusinessNetProfit,
    primary_business_type:              s.primaryBusinessType,
    primary_hours_per_week_in_business: s.primaryHoursPerWeekInBusiness,
    spouse_w2_income:                   s.spouseW2Income,
    spouse_business_revenue:            s.spouseBusinessRevenue,
    spouse_business_net_profit:         s.spouseBusinessNetProfit,
    spouse_business_type:               s.spouseBusinessType,
    spouse_hours_per_week_in_business:  s.spouseHoursPerWeekInBusiness,
    current_tax_paid:              s.currentTaxPaid,
    has_hsa_available:             s.hasHsaAvailable,
    has_cpa:                       s.hasCpa,
    cpa_proactive:                 s.cpaProactive,
    primary_residence_value:       s.primaryResidenceValue,
    mortgage_balance:              s.mortgageBalance,
    home_equity:                   s.homeEquity,
    currently_owns_rental:         s.currentlyOwnsRental,
    rental_property_value:         s.rentalPropertyValue,
    rental_mortgage_balance:       s.rentalMortgageBalance,
    retirement_balance:            s.retirementBalance,
    traditional_ira_balance:       s.traditionalIraBalance,
    taxable_brokerage_balance:     s.taxableBrokerageBalance,
    business_equity_value:         s.businessEquityValue,
    monthly_rental_income:         s.monthlyRentalIncome,
    monthly_dividend_income:       s.monthlyDividendIncome,
    essential_monthly_spend:       s.essentialMonthlySpend,
    discretionary_monthly_spend:   s.discretionaryMonthlySpend,
    monthly_spend:                 s.monthlySpend,
    emergency_fund:                s.emergencyFund,
    extra_debt_payments:           s.extraDebtPayments,
    child_support_monthly:         s.childSupportMonthly,
    alimony_monthly:               s.alimonyMonthly,
    car_loan_balance:              s.carLoanBalance,
    car_loan_rate:                 s.carLoanRate,
    car_loan_payment:              s.carLoanPayment,
    student_loan_balance:          s.studentLoanBalance,
    student_loan_rate:             s.studentLoanRate,
    student_loan_payment:         s.studentLoanPayment,
    personal_loan_balance:         s.personalLoanBalance,
    personal_loan_rate:            s.personalLoanRate,
    personal_loan_payment:        s.personalLoanPayment,
    credit_card_balance:           s.creditCardBalance,
    credit_card_rate:              s.creditCardRate,
    credit_card_payment:          s.creditCardPayment,
    business_loan_balance:         s.businessLoanBalance,
    business_loan_rate:            s.businessLoanRate,
    business_loan_payment:        s.businessLoanPayment,
    other_debt_label:              s.otherDebtLabel,
    other_debt_balance:            s.otherDebtBalance,
    other_debt_rate:               s.otherDebtRate,
    other_debt_payment:            s.otherDebtPayment,
    employer_401k_allows_after_tax: s.employer401kAllowsAfterTax ?? null,
    considering_real_estate:        s.consideringRealEstate,
    planned_property_value:         s.plannedPropertyValue ?? null,
    reps_qualified:                 s.repsQualified ?? null,
    excluded_strategy_ids:          JSON.stringify(s.excludedStrategyIds ?? []),
    target_acquisition_timeframe:   s.targetAcquisitionTimeframe ?? '',
  };
}

export function fromRow(row: SnapshotRow): FinancialSnapshot {
  const primaryResidenceValue = Number(row.primary_residence_value ?? 0);
  const mortgageBalance       = Number(row.mortgage_balance ?? 0);
  return {
    w2Income:                    Number(row.w2_income ?? 0),
    bonusIncome:                 Number(row.bonus_income ?? 0),
    bonusDeferred:               Number(row.bonus_deferred ?? 0),
    bonusTakenAsCash:            Number(row.bonus_taken_as_cash ?? 0),
    income1099:                  Number(row.income_1099 ?? 0),
    carAllowanceAnnual:          Number(row.car_allowance_annual ?? 0),
    otherIncomeAnnual:           Number(row.other_income_annual ?? 0),
    spouseWorks:                 Boolean(row.spouse_works),
    filingStatus:                (row.filing_status ?? 'mfj') as 'single' | 'mfj',
    state:                       String(row.state ?? 'CA'),
    dependentsUnder18:           Number(row.dependents_under_18 ?? 0),
    dependentAges:               String(row.dependent_ages ?? ''),
    hasBusinessEntity:                Boolean(row.has_business_entity),
    businessRevenue:                  Number(row.business_revenue ?? 0),
    primaryBusinessNetProfit:         Number(row.primary_business_net_profit ?? 0),
    primaryBusinessType:              String(row.primary_business_type ?? ''),
    primaryHoursPerWeekInBusiness:    Number(row.primary_hours_per_week_in_business ?? 0),
    spouseW2Income:                   Number(row.spouse_w2_income ?? 0),
    spouseBusinessRevenue:            Number(row.spouse_business_revenue ?? 0),
    spouseBusinessNetProfit:          Number(row.spouse_business_net_profit ?? 0),
    spouseBusinessType:               String(row.spouse_business_type ?? ''),
    spouseHoursPerWeekInBusiness:     Number(row.spouse_hours_per_week_in_business ?? 0),
    currentTaxPaid:              Number(row.current_tax_paid ?? 0),
    hasHsaAvailable:             Boolean(row.has_hsa_available),
    hasCpa:                      Boolean(row.has_cpa ?? false),
    cpaProactive:                Boolean(row.cpa_proactive ?? false),
    primaryResidenceValue,
    mortgageBalance,
    // Derived from the two raw columns above, not trusted from the stored home_equity
    // column directly — that column is kept in sync by toRow but isn't the source of truth.
    homeEquity:                  Math.max(0, primaryResidenceValue - mortgageBalance),
    currentlyOwnsRental:         Boolean(row.currently_owns_rental ?? false),
    rentalPropertyValue:         Number(row.rental_property_value ?? 0),
    rentalMortgageBalance:       Number(row.rental_mortgage_balance ?? 0),
    retirementBalance:           Number(row.retirement_balance ?? 0),
    traditionalIraBalance:       Number(row.traditional_ira_balance ?? 0),
    taxableBrokerageBalance:     Number(row.taxable_brokerage_balance ?? 0),
    businessEquityValue:         Number(row.business_equity_value ?? 0),
    monthlyRentalIncome:         Number(row.monthly_rental_income ?? 0),
    monthlyDividendIncome:       Number(row.monthly_dividend_income ?? 0),
    essentialMonthlySpend:       Number(row.essential_monthly_spend ?? 0),
    discretionaryMonthlySpend:   Number(row.discretionary_monthly_spend ?? 0),
    monthlySpend:                Number(row.monthly_spend ?? 0),
    emergencyFund:               Number(row.emergency_fund ?? 0),
    extraDebtPayments:           Number(row.extra_debt_payments ?? 0),
    childSupportMonthly:         Number(row.child_support_monthly ?? 0),
    alimonyMonthly:              Number(row.alimony_monthly ?? 0),
    carLoanBalance:              Number(row.car_loan_balance ?? 0),
    carLoanRate:                 Number(row.car_loan_rate ?? 0),
    carLoanPayment:              Number(row.car_loan_payment ?? 0),
    studentLoanBalance:          Number(row.student_loan_balance ?? 0),
    studentLoanRate:             Number(row.student_loan_rate ?? 0),
    studentLoanPayment:          Number(row.student_loan_payment ?? 0),
    personalLoanBalance:         Number(row.personal_loan_balance ?? 0),
    personalLoanRate:            Number(row.personal_loan_rate ?? 0),
    personalLoanPayment:         Number(row.personal_loan_payment ?? 0),
    creditCardBalance:           Number(row.credit_card_balance ?? 0),
    creditCardRate:              Number(row.credit_card_rate ?? 0),
    creditCardPayment:           Number(row.credit_card_payment ?? 0),
    businessLoanBalance:         Number(row.business_loan_balance ?? 0),
    businessLoanRate:            Number(row.business_loan_rate ?? 0),
    businessLoanPayment:         Number(row.business_loan_payment ?? 0),
    otherDebtLabel:              String(row.other_debt_label ?? ''),
    otherDebtBalance:            Number(row.other_debt_balance ?? 0),
    otherDebtRate:               Number(row.other_debt_rate ?? 0),
    otherDebtPayment:            Number(row.other_debt_payment ?? 0),
    debts:                       [],  // not persisted; callers merge in if needed
    employer401kAllowsAfterTax:  row.employer_401k_allows_after_tax ?? undefined,
    consideringRealEstate:          Boolean(row.considering_real_estate ?? false),
    plannedPropertyValue:           row.planned_property_value ?? undefined,
    repsQualified:                  row.reps_qualified ?? undefined,
    excludedStrategyIds:            (() => {
      try { return JSON.parse(row.excluded_strategy_ids ?? '[]') as string[]; }
      catch { return []; }
    })(),
    targetAcquisitionTimeframe:     row.target_acquisition_timeframe ?? undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSnapshotForServer(
  userId: string,
  sb: SupabaseClient,
): Promise<FinancialSnapshot | null> {
  const { data, error } = await sb
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getSnapshotForServer: ${error.message}`);
  if (!data) return null;
  return fromRow(data as SnapshotRow);
}

export async function saveSnapshot(snapshot: FinancialSnapshot): Promise<SnapshotRow> {
  const sb = getBrowserSupabaseClient();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated — sign in before saving a snapshot.');
  const { data, error } = await sb
    .from('financial_snapshots')
    .insert(toRow(user.id, snapshot))
    .select()
    .single();
  if (error) throw new Error(`saveSnapshot failed: ${error.message}`);
  return data as SnapshotRow;
}

export async function getLatestSnapshotWithId(): Promise<{ snapshot: FinancialSnapshot; id: string } | null> {
  const sb = getBrowserSupabaseClient();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated — sign in before loading a snapshot.');
  const { data, error } = await sb
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestSnapshotWithId failed: ${error.message}`);
  if (!data) return null;
  return { snapshot: fromRow(data as SnapshotRow), id: (data as SnapshotRow).id };
}

export async function getLatestSnapshot(): Promise<FinancialSnapshot | null> {
  const sb = getBrowserSupabaseClient();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated — sign in before loading a snapshot.');
  const { data, error } = await sb
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestSnapshot failed: ${error.message}`);
  if (!data) return null;
  return fromRow(data as SnapshotRow);
}
