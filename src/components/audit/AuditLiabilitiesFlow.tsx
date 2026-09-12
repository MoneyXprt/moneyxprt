'use client';

import { useMemo } from 'react';
import { getLiabilitySteps, LIABILITY_DEBT_DEFINITIONS, LIABILITY_MAX_STEPS, type LiabilitiesFormState, type LiabilityDebtDefinition, type TrackedLiabilityDebt } from '@/app/lib/audit/liabilitiesFlow';
import { useQuestionFlow } from '@/app/lib/useQuestionFlow';
import { DollarAnswer, IncomeQuestion, NumberAnswer } from '@/components/audit/IncomeQuestion';

/** Runs Liabilities as a local-only, branchable sequence that preserves final Audit saving. */
export function AuditLiabilitiesFlow({ form, trackedDebts, paidOffDebtTypes, onChange, onComplete }: { form: LiabilitiesFormState; trackedDebts: Readonly<Record<string, TrackedLiabilityDebt>>; paidOffDebtTypes: ReadonlySet<string>; onChange: (changes: Partial<LiabilitiesFormState>) => void; onComplete: () => void }) {
  const steps = useMemo(() => getLiabilitySteps(form, trackedDebts, paidOffDebtTypes), [form, trackedDebts, paidOffDebtTypes]);
  const flow = useQuestionFlow(steps, LIABILITY_MAX_STEPS);
  const advance = () => { const next = steps[flow.currentIndex + 1]; if (next) flow.goTo(next); else onComplete(); };
  const question = (title: string, explainer: string | undefined, content: React.ReactNode, nextLabel?: string) => <IncomeQuestion title={title} explainer={explainer} step={flow.currentIndex + 1} totalSteps={flow.totalSteps} onBack={flow.back} onNext={advance} nextLabel={nextLabel}>{content}</IncomeQuestion>;
  const debt = LIABILITY_DEBT_DEFINITIONS.find((definition) => flow.currentStep.startsWith(`${definition.type}-`));

  if (flow.currentStep === 'debt-types') return question('Which debts do you have right now?', undefined, <DebtTypeSelector form={form} onChange={onChange} />, 'Continue →');
  if (!debt) return null;
  if (flow.currentStep === `${debt.type}-tracked`) return question(`We’re already tracking your ${debt.label.toLowerCase()} — here’s what we have.`, undefined, <TrackedDebtSummary debt={debt} record={trackedDebts[debt.type]} />);
  if (flow.currentStep === `${debt.type}-paid-off`) return question(`${debt.label} is already paid off — nothing to do here.`, undefined, <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Already paid off — nothing to enter here.</p>);
  if (flow.currentStep === `${debt.type}-label`) return question('What’s this debt for?', 'E.g., home improvement, medical, a pool loan.', <TextAnswer value={form[debt.labelKey!]} onChange={(otherDebtLabel) => onChange({ otherDebtLabel })} />);
  if (flow.currentStep === `${debt.type}-balance`) return question(`What’s the balance on your ${debt.label.toLowerCase()}?`, undefined, <DollarAnswer value={form[debt.balanceKey]} onChange={(value) => onChange({ [debt.balanceKey]: value })} />);
  if (flow.currentStep === `${debt.type}-rate`) return question('What’s the interest rate?', undefined, <NumberAnswer suffix="% APR" value={form[debt.rateKey]} onChange={(value) => onChange({ [debt.rateKey]: value })} />);
  if (flow.currentStep === `${debt.type}-payment`) return question('What’s the minimum monthly payment?', undefined, <DollarAnswer value={form[debt.paymentKey]} onChange={(value) => onChange({ [debt.paymentKey]: value })} />);
  return question('What was the original loan amount, if you remember it?', 'Optional — leave blank and we’ll use today’s balance.', <DollarAnswer value={form[debt.originalBalanceKey]} onChange={(value) => onChange({ [debt.originalBalanceKey]: value })} />, 'Continue →');
}

/** Renders the single multi-select debt-type screen. */
function DebtTypeSelector({ form, onChange }: { form: LiabilitiesFormState; onChange: (changes: Partial<LiabilitiesFormState>) => void }) {
  return <div className="flex flex-wrap gap-2">{LIABILITY_DEBT_DEFINITIONS.map((debt) => <button key={debt.type} type="button" onClick={() => onChange({ [debt.selectionKey]: !form[debt.selectionKey] })} aria-pressed={form[debt.selectionKey]} className={`min-h-11 rounded-full border px-4 text-sm font-medium ${form[debt.selectionKey] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>{debt.label}</button>)}</div>;
}

/** Renders an active tracker record without offering a mid-onboarding edit path. */
function TrackedDebtSummary({ debt, record }: { debt: LiabilityDebtDefinition; record: TrackedLiabilityDebt | undefined }) {
  if (!record) return null;
  return <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm"><p><span className="text-gray-500">Balance</span><span className="float-right font-semibold text-gray-900">${record.balance.toLocaleString()}</span></p><p><span className="text-gray-500">Interest rate</span><span className="float-right font-semibold text-gray-900">{record.rate.toFixed(2)}% APR</span></p><p><span className="text-gray-500">Minimum monthly payment</span><span className="float-right font-semibold text-gray-900">${record.payment.toLocaleString()}</span></p>{debt.type === 'other' && <p className="border-t border-gray-200 pt-3 text-gray-600">Tracked as &ldquo;{record.name}&rdquo; — <a href="/dashboard/debts" className="font-medium text-emerald-700 underline">edit in Debts →</a></p>}<p className="border-t border-gray-200 pt-3 text-gray-500">Already tracked — nothing to enter here.</p></div>;
}

/** Renders a focused free-text answer for the other-debt description. */
function TextAnswer({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input autoFocus type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Pool loan" className="min-h-14 w-full rounded-xl border border-gray-200 px-4 text-lg font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />;
}
