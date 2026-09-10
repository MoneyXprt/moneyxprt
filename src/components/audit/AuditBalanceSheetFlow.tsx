'use client';

import { useMemo } from 'react';
import { calculateHomeEquity, clearRentalAnswers, hasEffectiveBusinessEntity, isMortgageAtOrAboveHomeValue, type BalanceSheetFormState, type EffectiveBusinessContext } from '@/app/lib/audit/balanceSheetFlow';
import { useQuestionFlow } from '@/app/lib/useQuestionFlow';
import { DollarAnswer, IncomeQuestion, YesNo } from '@/components/audit/IncomeQuestion';

type BalanceStep = 'home-value' | 'mortgage-balance' | 'rental-question' | 'rental-value' | 'rental-mortgage' | 'retirement' | 'traditional-ira' | 'brokerage' | 'business-equity';
const ALL_BALANCE_STEPS: readonly BalanceStep[] = ['home-value', 'mortgage-balance', 'rental-question', 'rental-value', 'rental-mortgage', 'retirement', 'traditional-ira', 'brokerage', 'business-equity'];

/** Runs Balance Sheet as a local-only, branchable sequence of questions. */
export function AuditBalanceSheetFlow({ form, businessContext, onChange, onComplete }: { form: BalanceSheetFormState; businessContext: EffectiveBusinessContext; onChange: (changes: Partial<BalanceSheetFormState>) => void; onComplete: () => void }) {
  const effectiveBusiness = hasEffectiveBusinessEntity(businessContext);
  const steps = useMemo(() => getBalanceSteps(form.currentlyOwnsRental, effectiveBusiness), [form.currentlyOwnsRental, effectiveBusiness]);
  const flow = useQuestionFlow(steps, ALL_BALANCE_STEPS.length);
  const next = (step: BalanceStep) => flow.goTo(step);
  const equity = calculateHomeEquity(form.primaryResidenceValue, form.mortgageBalance);
  const question = (title: string, explainer: string | undefined, content: React.ReactNode, onNext: () => void, showNext = true, label?: string) => <IncomeQuestion title={title} explainer={explainer} step={flow.currentIndex + 1} totalSteps={flow.totalSteps} onBack={flow.back} onNext={onNext} showNext={showNext} nextLabel={label}>{content}</IncomeQuestion>;

  switch (flow.currentStep) {
    case 'home-value': return question("What's your home worth, roughly?", "A rough estimate is fine — check a site like Zillow or Redfin if you're not sure.", <DollarAnswer value={form.primaryResidenceValue} onChange={(primaryResidenceValue) => onChange({ primaryResidenceValue })} />, () => next('mortgage-balance'));
    case 'mortgage-balance': return question('How much do you still owe on your mortgage?', 'Your current payoff balance, not the original loan amount.', <><DollarAnswer value={form.mortgageBalance} onChange={(mortgageBalance) => onChange({ mortgageBalance })} /><div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"><p className="text-sm font-semibold text-gray-900">Estimated home equity: ${equity.toLocaleString()}</p>{isMortgageAtOrAboveHomeValue(form.primaryResidenceValue, form.mortgageBalance) && <p className="mt-1 text-sm leading-relaxed text-gray-500">If your mortgage is more than your home&apos;s current value, your equity shows as $0 — that&apos;s expected, not an error.</p>}</div></>, () => next('rental-question'));
    case 'rental-question': return question('Do you currently own a rental property?', "This means you own one today — not that you're thinking about buying one.", <YesNo onYes={() => { onChange({ currentlyOwnsRental: true }); next('rental-value'); }} onNo={() => { onChange(clearRentalAnswers()); next('retirement'); }} />, onComplete, false);
    case 'rental-value': return question("What's that property worth, roughly?", undefined, <DollarAnswer value={form.rentalPropertyValue} onChange={(rentalPropertyValue) => onChange({ rentalPropertyValue })} />, () => next('rental-mortgage'));
    case 'rental-mortgage': return question('How much is left on that mortgage, if any?', undefined, <DollarAnswer value={form.rentalMortgageBalance} onChange={(rentalMortgageBalance) => onChange({ rentalMortgageBalance })} />, () => next('retirement'));
    case 'retirement': return question('How much do you have in retirement accounts — 401(k)s and IRAs combined?', 'Add up the balances across all your retirement accounts.', <DollarAnswer value={form.retirementBalance} onChange={(retirementBalance) => onChange({ retirementBalance })} />, () => next('traditional-ira'));
    case 'traditional-ira': return question('Of that, how much is in a Traditional IRA specifically?', "This matters for a strategy called the backdoor Roth — if you're not sure, it's fine to estimate or leave at zero.", <DollarAnswer value={form.traditionalIraBalance} onChange={(traditionalIraBalance) => onChange({ traditionalIraBalance })} />, () => next('brokerage'));
    case 'brokerage': return question('How much do you have in a regular investment account — not retirement?', 'A taxable brokerage account, not a 401(k) or IRA.', <DollarAnswer value={form.taxableBrokerageBalance} onChange={(taxableBrokerageBalance) => onChange({ taxableBrokerageBalance })} />, () => effectiveBusiness ? next('business-equity') : onComplete());
    case 'business-equity': return question("Roughly what's your business worth if you sold it today?", undefined, <DollarAnswer value={form.businessEquityValue} onChange={(businessEquityValue) => onChange({ businessEquityValue })} />, onComplete, true, 'Continue to liabilities →');
  }
}

/** Builds the active Balance Sheet path from rental ownership and household business context. */
function getBalanceSteps(currentlyOwnsRental: boolean, effectiveBusiness: boolean): BalanceStep[] {
  return ['home-value', 'mortgage-balance', 'rental-question', ...(currentlyOwnsRental ? ['rental-value', 'rental-mortgage'] : []), 'retirement', 'traditional-ira', 'brokerage', ...(effectiveBusiness ? ['business-equity'] : [])] as BalanceStep[];
}
