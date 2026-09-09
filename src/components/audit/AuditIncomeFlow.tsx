'use client';

import { useMemo, useState } from 'react';
import { clampDeferredBonus, parseIncomeAmount, type BonusFrequency, type IncomeFormState, type SpouseIncomeType } from '@/app/lib/audit/incomeFlow';
import { useQuestionFlow } from '@/app/lib/useQuestionFlow';
import { DollarAnswer, IncomeQuestion, YesNo } from '@/components/audit/IncomeQuestion';

type IncomeStep = 'salary' | 'bonus-question' | 'bonus-amount' | 'bonus-deferred-question' | 'bonus-deferred-amount' | 'bonus-frequency' | 'bonus-plan-amount' | 'bonus-payment-month' | 'income1099-question' | 'income1099-amount' | 'allowance-question' | 'allowance-amount' | 'rental-question' | 'rental-amount' | 'dividend-question' | 'dividend-amount' | 'other-question' | 'other-amount' | 'spouse-question' | 'spouse-type' | 'spouse-w2' | 'spouse-revenue' | 'spouse-profit';

interface PresenceAnswers { hasBonus: boolean; has1099: boolean; hasAllowance: boolean; hasRental: boolean; hasDividend: boolean; hasOther: boolean; }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Runs the Income portion of Audit as local-only, branchable questions. */
export function AuditIncomeFlow({ form, onChange, onComplete }: { form: IncomeFormState; onChange: (changes: Partial<IncomeFormState>) => void; onComplete: () => void }) {
  const [presence, setPresence] = useState<PresenceAnswers>({ hasBonus: Number(form.bonusIncome) > 0, has1099: Number(form.income1099) > 0, hasAllowance: Number(form.carAllowanceAnnual) > 0, hasRental: Number(form.monthlyRentalIncome) > 0, hasDividend: Number(form.monthlyDividendIncome) > 0, hasOther: Number(form.otherIncomeAnnual) > 0 });
  const [error, setError] = useState('');
  const steps = useMemo(() => getSteps(form, presence), [form, presence]);
  const flow = useQuestionFlow(steps);
  const next = (step: IncomeStep) => flow.goTo(step);
  const finish = () => onComplete();
  const automaticSteps: readonly IncomeStep[] = ['bonus-question', 'bonus-deferred-question', 'bonus-frequency', 'income1099-question', 'allowance-question', 'rental-question', 'dividend-question', 'other-question', 'spouse-question', 'spouse-type'];
  const question = (title: string, explainer: string | undefined, content: React.ReactNode, onNext: () => void, label?: string) => <IncomeQuestion title={title} explainer={explainer} step={flow.currentIndex + 1} totalSteps={flow.totalSteps} onBack={flow.back} onNext={onNext} nextLabel={label} showNext={!automaticSteps.includes(flow.currentStep)}>{content}{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</IncomeQuestion>;

  switch (flow.currentStep) {
    case 'salary': return question("What's your base salary?", 'Your gross salary before taxes, from your W-2.', <DollarAnswer value={form.w2Income} onChange={(w2Income) => { setError(''); onChange({ w2Income }); }} />, () => next('bonus-question'));
    case 'bonus-question': return question('Do you get a bonus or profit share?', undefined, <YesNo onYes={() => { setPresence((value) => ({ ...value, hasBonus: true })); next('bonus-amount'); }} onNo={() => { setPresence((value) => ({ ...value, hasBonus: false })); onChange({ bonusIncome: '', bonusDefers: false, bonusDeferred: '', bonusFrequency: '', bonusPlanAmount: '', bonusPaymentMonth: '' }); next('income1099-question'); }} />, finish);
    case 'bonus-amount': return question("What's your total expected bonus, before any deferral?", 'The full amount before your company holds any of it back for later.', <DollarAnswer value={form.bonusIncome} onChange={(bonusIncome) => { setError(''); onChange({ bonusIncome, bonusDeferred: clampDeferredBonus(form.bonusDeferred, bonusIncome) }); }} />, () => parseIncomeAmount(form.bonusIncome) > 0 ? next('bonus-deferred-question') : setError('Enter your total expected bonus before continuing.'));
    case 'bonus-deferred-question': return question('Does your company defer part of your bonus?', "Some companies hold back a portion of your bonus to pay out in a future year — you don't get taxed on that part now.", <YesNo onYes={() => { onChange({ bonusDefers: true }); next('bonus-deferred-amount'); }} onNo={() => { onChange({ bonusDefers: false, bonusDeferred: '' }); next('bonus-frequency'); }} />, finish);
    case 'bonus-deferred-amount': return question('How much is deferred?', "The part you won't receive as cash this year.", <DollarAnswer value={form.bonusDeferred} onChange={(bonusDeferred) => onChange({ bonusDeferred: clampDeferredBonus(bonusDeferred, form.bonusIncome) })} />, () => next('bonus-frequency'));
    case 'bonus-frequency': return question('How is your bonus paid — all at once, or throughout the year?', undefined, <ChoiceList<BonusFrequency> choices={[['annual', 'Annually'], ['quarterly', 'Quarterly'], ['monthly', 'Monthly']]} value={form.bonusFrequency} onSelect={(bonusFrequency) => { onChange({ bonusFrequency, bonusPlanAmount: bonusFrequency === 'monthly' ? '' : form.bonusPlanAmount, bonusPaymentMonth: bonusFrequency === 'monthly' ? '' : form.bonusPaymentMonth }); next(bonusFrequency === 'monthly' ? 'income1099-question' : 'bonus-plan-amount'); }} />, finish);
    case 'bonus-plan-amount': return question('How much is each bonus payment?', form.bonusFrequency === 'quarterly' ? 'The amount paid each quarter.' : 'The amount paid once a year.', <DollarAnswer value={form.bonusPlanAmount} onChange={(bonusPlanAmount) => { setError(''); onChange({ bonusPlanAmount }); }} />, () => parseIncomeAmount(form.bonusPlanAmount) > 0 ? next('bonus-payment-month') : setError('Enter your estimated bonus amount before continuing.'));
    case 'bonus-payment-month': return question('What month is it typically paid?', undefined, <ChoiceList choices={MONTHS.map((month, index) => [String(index + 1), month] as const)} value={form.bonusPaymentMonth} onSelect={(bonusPaymentMonth) => { setError(''); onChange({ bonusPaymentMonth }); }} />, () => form.bonusPaymentMonth ? next('income1099-question') : setError('Select the month your bonus is typically paid.'));
    case 'income1099-question': return incomeYesNo('Do you have any 1099 or freelance income?', 'Money you earn outside your regular job — consulting, freelance work, side gigs — where no taxes were withheld.', 'has1099', 'income1099', 'allowance-question');
    case 'income1099-amount': return question('How much 1099 or freelance income do you expect this year?', undefined, <DollarAnswer value={form.income1099} onChange={(income1099) => onChange({ income1099 })} />, () => next('allowance-question'));
    case 'allowance-question': return incomeYesNo('Does your job give you a car allowance or other taxable perks?', 'Extra pay for things like a company car allowance or phone reimbursement, added to your taxable income.', 'hasAllowance', 'carAllowanceAnnual', 'rental-question');
    case 'allowance-amount': return question('How much do those taxable perks add up to each year?', undefined, <DollarAnswer value={form.carAllowanceAnnual} onChange={(carAllowanceAnnual) => onChange({ carAllowanceAnnual })} />, () => next('rental-question'));
    case 'rental-question': return incomeYesNo('Do you have any rental income?', 'Monthly income from a property you currently own and rent out.', 'hasRental', 'monthlyRentalIncome', 'dividend-question');
    case 'rental-amount': return question('How much rental income do you receive each month?', undefined, <DollarAnswer value={form.monthlyRentalIncome} onChange={(monthlyRentalIncome) => onChange({ monthlyRentalIncome })} />, () => next('dividend-question'));
    case 'dividend-question': return incomeYesNo('Do you have dividend or investment income?', 'Regular distributions from stocks, funds, or REITs — not one-time gains.', 'hasDividend', 'monthlyDividendIncome', 'other-question');
    case 'dividend-amount': return question('How much dividend or investment income do you receive each month?', undefined, <DollarAnswer value={form.monthlyDividendIncome} onChange={(monthlyDividendIncome) => onChange({ monthlyDividendIncome })} />, () => next('other-question'));
    case 'other-question': return incomeYesNo("Any other regular income?", "Anything recurring you haven't already told us about — royalties, alimony received, etc.", 'hasOther', 'otherIncomeAnnual', 'spouse-question');
    case 'other-amount': return question('How much other regular income do you receive each year?', undefined, <DollarAnswer value={form.otherIncomeAnnual} onChange={(otherIncomeAnnual) => onChange({ otherIncomeAnnual })} />, () => next('spouse-question'));
    case 'spouse-question': return question('Does your spouse or partner earn income?', undefined, <YesNo onYes={() => { onChange({ spouseWorks: true }); next('spouse-type'); }} onNo={() => { onChange({ spouseWorks: false, spouseIncomeType: '', spouseW2Income: '', spouseBusinessRevenue: '', spouseBusinessNetProfit: '' }); finish(); }} />, finish);
    case 'spouse-type': return question('Is that from a job, their own business, or both?', undefined, <ChoiceList<SpouseIncomeType> choices={[['w2', 'A job'], ['self_employment', 'Their own business'], ['both', 'Both']]} value={form.spouseIncomeType} onSelect={(spouseIncomeType) => { onChange({ spouseIncomeType }); next(spouseIncomeType === 'w2' || spouseIncomeType === 'both' ? 'spouse-w2' : 'spouse-revenue'); }} />, finish);
    case 'spouse-w2': return question("What's their annual income from their job?", undefined, <DollarAnswer value={form.spouseW2Income} onChange={(spouseW2Income) => onChange({ spouseW2Income })} />, () => form.spouseIncomeType === 'both' ? next('spouse-revenue') : finish());
    case 'spouse-revenue': return question('What is their business gross revenue?', 'Total revenue before expenses.', <DollarAnswer value={form.spouseBusinessRevenue} onChange={(spouseBusinessRevenue) => onChange({ spouseBusinessRevenue })} />, () => next('spouse-profit'));
    case 'spouse-profit': return question('What is their business net profit?', 'After all business expenses — this is what gets taxed.', <DollarAnswer value={form.spouseBusinessNetProfit} onChange={(spouseBusinessNetProfit) => onChange({ spouseBusinessNetProfit })} />, finish, 'Continue to tax situation →');
  }

  function incomeYesNo(title: string, explainer: string, key: keyof PresenceAnswers, field: keyof IncomeFormState, nextStep: IncomeStep) {
    const amountSteps: Record<keyof PresenceAnswers, IncomeStep> = { hasBonus: 'bonus-amount', has1099: 'income1099-amount', hasAllowance: 'allowance-amount', hasRental: 'rental-amount', hasDividend: 'dividend-amount', hasOther: 'other-amount' };
    const amountStep = amountSteps[key];
    return question(title, explainer, <YesNo onYes={() => { setPresence((value) => ({ ...value, [key]: true })); next(amountStep); }} onNo={() => { setPresence((value) => ({ ...value, [key]: false })); onChange({ [field]: '' }); next(nextStep); }} />, finish);
  }
}

/** Renders a set of plain-language selection buttons. */
function ChoiceList<T extends string>({ choices, value, onSelect }: { choices: readonly (readonly [T, string])[]; value: T; onSelect: (value: T) => void }) {
  return <div className="space-y-3">{choices.map(([choice, label]) => <button key={choice} type="button" onClick={() => onSelect(choice)} className={`min-h-14 w-full rounded-xl border-2 px-4 text-left text-base font-semibold ${value === choice ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-700'}`}>{label}</button>)}</div>;
}

/** Builds the visible steps from the local yes/no answers. */
function getSteps(form: IncomeFormState, presence: PresenceAnswers): IncomeStep[] {
  return ['salary', 'bonus-question', ...(presence.hasBonus ? ['bonus-amount', 'bonus-deferred-question', ...(form.bonusDefers ? ['bonus-deferred-amount'] : []), 'bonus-frequency', ...(form.bonusFrequency === 'quarterly' || form.bonusFrequency === 'annual' ? ['bonus-plan-amount', 'bonus-payment-month'] : [])] : []), 'income1099-question', ...(presence.has1099 ? ['income1099-amount'] : []), 'allowance-question', ...(presence.hasAllowance ? ['allowance-amount'] : []), 'rental-question', ...(presence.hasRental ? ['rental-amount'] : []), 'dividend-question', ...(presence.hasDividend ? ['dividend-amount'] : []), 'other-question', ...(presence.hasOther ? ['other-amount'] : []), 'spouse-question', ...(form.spouseWorks ? ['spouse-type', ...(form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both' ? ['spouse-w2'] : []), ...(form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both' ? ['spouse-revenue', 'spouse-profit'] : [])] : [])] as IncomeStep[];
}
