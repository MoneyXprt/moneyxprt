import type { ReactNode } from 'react';
import { LifeEventShell } from '@/components/LifeEventShell';

/** Renders the shared one-question Audit screen with standard navigation. */
export function IncomeQuestion({ title, explainer, step, totalSteps, onBack, onNext, nextLabel = 'Next →', showNext = true, children }: {
  title: string; explainer?: string; step: number; totalSteps: number; onBack: () => void; onNext: () => void; nextLabel?: string; showNext?: boolean; children: ReactNode;
}) {
  return <LifeEventShell step={step} totalSteps={totalSteps} onBack={onBack}><div className="flex min-h-[calc(100vh-11rem)] flex-col"><div><h1 className="text-2xl font-bold leading-tight text-gray-900">{title}</h1>{explainer && <p className="mt-3 text-base leading-relaxed text-gray-500">{explainer}</p>}</div><div className="mt-8">{children}</div>{showNext && <button type="button" onClick={onNext} className="mt-auto min-h-11 w-full rounded-xl bg-emerald-600 px-5 text-base font-bold text-white transition hover:bg-emerald-700">{nextLabel}</button>}</div></LifeEventShell>;
}

/** Renders a plain-language yes/no choice with 44px minimum targets. */
export function YesNo({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return <div className="grid grid-cols-2 gap-3"><button type="button" onClick={onYes} className="min-h-14 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 text-base font-bold text-emerald-900">Yes</button><button type="button" onClick={onNo} className="min-h-14 rounded-xl border-2 border-gray-200 bg-white px-4 text-base font-bold text-gray-700">No</button></div>;
}

/** Renders a focused currency input suitable for a single-question screen. */
export function DollarAnswer({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl text-gray-400">$</span><input autoFocus inputMode="decimal" type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" className="min-h-14 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-2xl font-bold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" /></div>;
}

/** Renders a focused numeric answer with an optional unit suffix. */
export function NumberAnswer({ value, onChange, suffix }: { value: string; onChange: (value: string) => void; suffix?: string }) {
  return <div className="relative"><input autoFocus inputMode="decimal" type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" className="min-h-14 w-full rounded-xl border border-gray-200 px-4 pr-20 text-2xl font-bold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />{suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-gray-400">{suffix}</span>}</div>;
}

/** Renders mutually exclusive, plain-language options for a single answer. */
export function ChoiceList<T extends string>({ choices, value, onSelect }: { choices: readonly (readonly [T, string])[]; value: T; onSelect: (value: T) => void }) {
  return <div className="space-y-3">{choices.map(([choice, label]) => <button key={choice} type="button" onClick={() => onSelect(choice)} className={`min-h-14 w-full rounded-xl border-2 px-4 text-left text-base font-semibold ${value === choice ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-700'}`}>{label}</button>)}</div>;
}
