'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { useAuthSession } from '@/app/lib/useAuthSession';
import {
  evaluateSpouseBusinessStrategies,
  type SpouseBusinessExpenseCategory,
} from '@/app/lib/calculations/spouseBusiness';
import {
  buildSpouseBusinessInputs,
  draftFromSnapshot,
  getTopSpouseBusinessStrategies,
  SPOUSE_BUSINESS_STEP_COUNT,
} from '@/app/lib/lifeEvents/spouseBusinessModel';
import { getSpouseBusinessSnapshotContext } from '@/app/lib/lifeEvents/spouseBusinessRepository';
import {
  EMPTY_SPOUSE_BUSINESS_DRAFT,
  type SpouseBusinessDraft,
  type SpouseBusinessSnapshotContext,
} from '@/app/lib/lifeEvents/spouseBusinessTypes';
import { LifeEventAnonPrompt, LifeEventShell } from '@/components/LifeEventShell';
import {
  ExpensesQuestion,
  HelpersQuestion,
  RevenueQuestion,
  SalesQuestion,
} from '@/components/spouseBusiness/SpouseBusinessQuestions';
import { SpouseBusinessResults } from '@/components/spouseBusiness/SpouseBusinessResults';

type PageState = 'loading' | 'ready' | 'empty' | 'error';

/** Four-question spouse-business flow and ranked results. */
export default function SpouseBusinessPage() {
  const router = useRouter();
  const { session, status } = useAuthSession();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [context, setContext] = useState<SpouseBusinessSnapshotContext | null>(null);
  const [draft, setDraft] = useState<SpouseBusinessDraft>(EMPTY_SPOUSE_BUSINESS_DRAFT);
  const [step, setStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [revenueError, setRevenueError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setPageState('loading');
    getSpouseBusinessSnapshotContext(getBrowserSupabaseClient(), session.user.id)
      .then((nextContext) => {
        if (!active) return;
        if (!nextContext) {
          setPageState('empty');
          return;
        }
        setContext(nextContext);
        setDraft(draftFromSnapshot(nextContext));
        setPageState('ready');
      })
      .catch(() => active && setPageState('error'));
    return () => { active = false; };
  }, [session]);

  const strategies = useMemo(() => {
    if (!context || !draft.familyInvolvement) return [];
    return getTopSpouseBusinessStrategies(
      evaluateSpouseBusinessStrategies(buildSpouseBusinessInputs(draft, context)),
    );
  }, [context, draft]);

  /** Go back one question, or return from results to the final question. */
  function handleBack() {
    if (showResults) setShowResults(false);
    else if (step > 1) setStep((value) => value - 1);
    else router.push('/dashboard/life-events');
  }

  /** Validate the current answer before advancing. */
  function continueFlow() {
    if (step === 2 && (draft.monthlyRevenue === null || draft.monthlyRevenue < 0)) {
      setRevenueError('Enter an amount of $0 or more.');
      return;
    }
    if (step === 4 && !draft.familyInvolvement) return;
    setRevenueError('');
    if (step === SPOUSE_BUSINESS_STEP_COUNT) setShowResults(true);
    else setStep((value) => value + 1);
  }

  /** Persist the four recommendations, regenerate, and open Execute. */
  async function addToPlan() {
    if (!session || !draft.familyInvolvement) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/life-events/spouse-business', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyRevenue: draft.hasSales ? draft.monthlyRevenue ?? 0 : 0,
          strategyIds: strategies.map((strategy) => strategy.id),
          expenseCategories: draft.expenseCategories,
          familyInvolvement: draft.familyInvolvement,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not update your plan.');
      router.push('/dashboard/execute?added=spouse-business');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not update your plan.');
      setSaving(false);
    }
  }

  if (status === 'loading' || (status === 'authed' && pageState === 'loading')) {
    return <FlowMessage kind="loading" />;
  }
  if (status === 'anon') return <LifeEventShell><LifeEventAnonPrompt /></LifeEventShell>;
  if (pageState === 'empty') return <FlowMessage kind="empty" />;
  if (pageState === 'error') return <FlowMessage kind="error" />;

  return (
    <LifeEventShell
      step={showResults ? undefined : step}
      totalSteps={showResults ? undefined : SPOUSE_BUSINESS_STEP_COUNT}
      onBack={handleBack}
    >
      {showResults ? (
        <SpouseBusinessResults strategies={strategies} saving={saving} error={saveError} onAdd={addToPlan} />
      ) : (
        <div className="pb-24">
          {step === 1 && <SalesQuestion value={draft.hasSales} onSelect={(hasSales) => { setDraft((value) => ({ ...value, hasSales, monthlyRevenue: hasSales ? value.monthlyRevenue : 0 })); setStep(2); }} />}
          {step === 2 && <RevenueQuestion value={draft.monthlyRevenue} error={revenueError} onChange={(monthlyRevenue) => setDraft((value) => ({ ...value, monthlyRevenue }))} />}
          {step === 3 && <ExpensesQuestion values={draft.expenseCategories} onToggle={(expense) => toggleExpense(expense, draft, setDraft)} />}
          {step === 4 && <HelpersQuestion value={draft.familyInvolvement} onSelect={(familyInvolvement) => setDraft((value) => ({ ...value, familyInvolvement }))} />}
          {step > 1 && <ContinueButton label={step === 4 ? 'Show my strategies' : 'Continue'} disabled={step === 4 && !draft.familyInvolvement} onClick={continueFlow} />}
        </div>
      )}
    </LifeEventShell>
  );
}

function toggleExpense(expense: SpouseBusinessExpenseCategory, draft: SpouseBusinessDraft, setDraft: React.Dispatch<React.SetStateAction<SpouseBusinessDraft>>) {
  const selected = draft.expenseCategories.includes(expense);
  setDraft((value) => ({ ...value, expenseCategories: selected ? value.expenseCategories.filter((id) => id !== expense) : [...value.expenseCategories, expense] }));
}

function ContinueButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 p-4 backdrop-blur"><button type="button" disabled={disabled} onClick={onClick} className="mx-auto block min-h-[52px] w-full max-w-lg rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">{label}</button></div>;
}

function FlowMessage({ kind }: { kind: 'loading' | 'empty' | 'error' }) {
  const copy = kind === 'empty' ? ['Add your financial snapshot first', 'We use it to prefill this flow and estimate each strategy.'] : kind === 'error' ? ['We couldn’t load your snapshot', 'Try again, or return to the dashboard.'] : ['Loading your business details…', ''];
  return <LifeEventShell><div className="pt-16 text-center">{kind === 'loading' && <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />}<h1 className="text-lg font-bold text-gray-900">{copy[0]}</h1>{copy[1] && <p className="mt-2 text-sm text-gray-500">{copy[1]}</p>}{kind !== 'loading' && <Link href={kind === 'empty' ? '/dashboard/audit' : '/dashboard'} className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white">{kind === 'empty' ? 'Add my snapshot' : 'Back to dashboard'}</Link>}</div></LifeEventShell>;
}
