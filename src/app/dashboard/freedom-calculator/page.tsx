'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Theme (matches freedom-vision's dark palette) ────────────────────────────

const GOLD   = '#C9A84C';
const FOREST = '#1B3A2D';

// ─── Category definitions ─────────────────────────────────────────────────────

interface Category {
  key: string;
  label: string;
  hint: string;
  description: string;
  defaultValue: number;
  icon: React.ReactNode;
}

const CATEGORIES: Category[] = [
  {
    key: 'housing',
    label: 'Housing',
    hint: 'Mortgage, rent, or property tax at your free-life location.',
    description:
      '$4,000/month covers a comfortable home in most mid-tier markets. ' +
      'Coastal spots like Carlsbad, CA or Austin, TX run $5,000–$6,500. ' +
      'Be honest about where you actually want to live.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    key: 'health_insurance',
    label: 'Health Insurance',
    hint: 'Self-employed rate — no employer subsidy.',
    description:
      'Without an employer, you\'re buying on the open market. A family plan ' +
      'typically runs $1,200–$1,800/month depending on age, coverage tier, ' +
      'and state. Budget for the real number, not the wishful one.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    key: 'food',
    label: 'Food & Daily Life',
    hint: 'Groceries, restaurants, coffee, household supplies.',
    description:
      '$2,000/month for a family of 4 is realistic but tight. ' +
      '$2,500–$3,000 if you eat out regularly or live in a high-cost area. ' +
      'Include the Sunday farmers market and date nights.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 20.488V18a2.25 2.25 0 00-2.25-2.25h-1.5A2.25 2.25 0 009 18v2.488m3 0h.008v.015H12v-.015zm0 0H9.75m2.25 0H14.25" />
      </svg>
    ),
  },
  {
    key: 'transportation',
    label: 'Transportation',
    hint: 'Car payment, insurance, fuel, maintenance, registration.',
    description:
      '$1,200/month covers a mid-range car payment ($600), insurance ($250), ' +
      'fuel ($200), and maintenance/registration ($150). ' +
      'Go car-free or drive paid-off vehicles to drop this significantly.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    key: 'travel',
    label: 'Travel & Experiences',
    hint: 'Vacations, hobbies, concerts, sports, adventures.',
    description:
      'This is the whole point. $1,500/month ($18k/year) covers 2–3 solid ' +
      'family trips, regular weekend experiences, and hobbies. ' +
      'If travel is a core value, size this up — this is freedom, not retirement.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    ),
  },
  {
    key: 'kids_family',
    label: 'Kids & Family',
    hint: 'Private school, tutors, activities, sports, support for aging parents.',
    description:
      '$1,500/month is a realistic floor for one or two school-age kids ' +
      '(activities, gear, enrichment). Private school or college savings ' +
      'can push this to $3,000–$5,000+. Build in what you actually want for them.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    ),
  },
  {
    key: 'savings_buffer',
    label: 'Savings & Investment Buffer',
    hint: 'Still investing and building in your free life.',
    description:
      'Freedom doesn\'t mean stopping wealth-building. $1,000/month keeps ' +
      'you compounding, covers irregular large expenses (roof, car, ' +
      'medical), and gives you peace of mind. Think of it as your runway margin.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    key: 'miscellaneous',
    label: 'Everything Else',
    hint: 'Subscriptions, gifts, clothing, personal care, surprises.',
    description:
      '$500/month is intentionally lean. You\'ve already built buffers ' +
      'elsewhere. This covers streaming, phone, haircuts, birthday gifts, ' +
      'and the random things you can\'t predict. Go higher if your lifestyle warrants it.',
    defaultValue: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const DEFAULT_VALUES = CATEGORIES.map(c => c.defaultValue);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return fmtMoney(n);
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await getBrowserSupabaseClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/freedom-calculator` },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };

  useEffect(() => {
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange(
      (_e, s) => { if (s) onSession(s); },
    );
    return () => subscription.unsubscribe();
  }, [onSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Freedom Calculator</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">Sign in to calculate your freedom number.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  values, onBack, onSave, saving, saveError,
}: {
  values: number[];
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  const total     = values.reduce((s, v) => s + v, 0);
  const portfolio = total * 300;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-sm font-medium text-white/50 mb-1">Your Freedom Number</p>
        <p className="text-5xl font-extrabold tabular-nums leading-none" style={{ color: GOLD }}>
          {fmtMoney(total)}
          <span className="text-xl font-normal text-white/40 ml-1">/mo</span>
        </p>
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-sm text-white/50 mb-0.5">Portfolio needed (4% rule)</p>
          <p className="text-3xl font-bold tabular-nums" style={{ color: GOLD }}>{fmtCompact(portfolio)}</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-sm text-white/70 leading-relaxed">
          To be free, you need a portfolio generating{' '}
          <strong>{fmtMoney(total)}/month</strong> passively.
          At a 4% safe withdrawal rate, that&apos;s{' '}
          <strong>approximately {fmtCompact(portfolio)}</strong> in investable assets —
          the point where your money works harder than you do.
        </p>
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Breakdown</p>
        </div>
        <div>
          {CATEGORIES.map((cat, i) => (
            <div key={cat.key} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm text-white/70">{cat.label}</span>
              <span className="text-sm font-semibold text-white tabular-nums">{fmtMoney(values[i])}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(201,168,76,0.12)' }}>
            <span className="text-sm font-bold text-white">Monthly total</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: GOLD }}>{fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-4 text-xs text-red-700">{saveError}</div>
      )}

      {/* CTA */}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mb-3"
        style={{ background: GOLD, color: FOREST }}
      >
        {saving ? (
          <><span className="w-5 h-5 border-2 border-[#1B3A2D]/40 border-t-[#1B3A2D] rounded-full animate-spin" /> Saving…</>
        ) : (
          <>Your freedom number is locked in. Next: assets &amp; timeline →</>
        )}
      </button>

      <button onClick={onBack}
        className="w-full py-3 rounded-2xl border text-sm font-medium text-white/60 hover:bg-white/[0.08] transition"
        style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
        ← Review my numbers
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FreedomCalculatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFresh = searchParams.get('fresh') === 'true';
  const [session, setSession]           = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [step, setStep]     = useState(0);           // 0–7 = categories, 8 = results
  const [values, setValues] = useState<number[]>(DEFAULT_VALUES);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Session ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s && !isFresh) {
        // Load most recent freedom profile if exists
        const { data } = await sb
          .from('freedom_profiles')
          .select('housing,health_insurance,food,transportation,travel,kids,savings_buffer,misc')
          .eq('user_id', s.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setValues([
            Number(data.housing), Number(data.health_insurance),
            Number(data.food),    Number(data.transportation),
            Number(data.travel),  Number(data.kids),
            Number(data.savings_buffer), Number(data.misc),
          ]);
        }
      }
    });
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange(
      (_e, s) => setSession(s),
    );
    return () => subscription.unsubscribe();
  }, []);

  // Focus input when step changes
  useEffect(() => {
    if (step < CATEGORIES.length) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [step]);

  const total = values.reduce((s, v) => s + v, 0);

  const setValue = (idx: number, raw: string) => {
    const parsed = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0);
    setValues(prev => prev.map((v, i) => (i === idx ? parsed : v)));
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true); setSaveError(null);
    try {
      const freedomNumberMonthly = total;
      const portfolioTarget      = total * 300;
      const { error } = await getBrowserSupabaseClient()
        .from('freedom_profiles')
        .upsert(
          {
            user_id:                session.user.id,
            housing:                values[0],
            health_insurance:       values[1],
            food:                   values[2],
            transportation:         values[3],
            travel:                 values[4],
            kids:                   values[5],
            savings_buffer:         values[6],
            misc:                   values[7],
            freedom_number_monthly: freedomNumberMonthly,
            portfolio_target:       portfolioTarget,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      router.push('/dashboard/audit' + (isFresh ? '?fresh=true' : ''));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  const cat = CATEGORIES[step];
  const isResultsStep = step === CATEGORIES.length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: FOREST }}>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10" style={{ background: FOREST, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: GOLD }}>
              <svg className="w-4 h-4" style={{ color: FOREST }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">Freedom Calculator</span>
          </div>
          <span className="text-xs text-white/40 tabular-nums">
            {isResultsStep ? 'Complete' : `${step + 1} / ${CATEGORIES.length}`}
          </span>
        </div>
      </header>

      {/* ── Running total bar ───────────────────────────────────────────── */}
      {!isResultsStep && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 leading-none mb-0.5">Running total</p>
              <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: GOLD }}>
                {fmtMoney(total)}
                <span className="text-sm font-normal text-white/40 ml-1">/mo</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 leading-none mb-0.5">Portfolio needed</p>
              <p className="text-base font-bold text-white/80 tabular-nums">{fmtCompact(total * 300)}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="max-w-lg mx-auto px-4 pb-3">
            <div className="flex gap-1">
              {CATEGORIES.map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i < step ? GOLD : i === step ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.12)' }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 flex flex-col gap-4"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

        {isResultsStep ? (
          <ResultsScreen
            values={values}
            onBack={() => setStep(CATEGORIES.length - 1)}
            onSave={handleSave}
            saving={saving}
            saveError={saveError}
          />
        ) : (
          <>
            {/* Category card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {/* Category header */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.15)', color: GOLD }}>
                    {cat.icon}
                  </div>
                  <div>
                    <p className="text-xs text-white/40">
                      Category {step + 1} of {CATEGORIES.length}
                    </p>
                    <h2 className="text-lg font-bold text-white leading-tight">{cat.label}</h2>
                  </div>
                </div>
                <p className="text-sm text-white/55">{cat.hint}</p>
              </div>

              {/* Input */}
              <div className="px-5 pb-5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-white/40 text-2xl font-light pointer-events-none">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={values[step] === 0 ? '' : values[step].toLocaleString('en-US')}
                    placeholder={String(cat.defaultValue)}
                    onChange={e => setValue(step, e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-10 pr-16 py-4 text-3xl font-bold text-white rounded-xl focus:outline-none tabular-nums transition"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.18)' }}
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-white/40 text-sm pointer-events-none">/mo</span>
                </div>
              </div>
            </div>

            {/* Context card */}
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <p className="text-xs text-white/70 leading-relaxed">{cat.description}</p>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-auto pt-2">
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="flex-1 py-4 rounded-2xl border text-sm font-medium text-white/60 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition"
                style={{ borderColor: 'rgba(255,255,255,0.18)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-[2] py-4 rounded-2xl font-bold transition active:scale-[0.98]"
                style={{ background: GOLD, color: FOREST }}
              >
                {step === CATEGORIES.length - 1 ? 'See my freedom number →' : 'Next →'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
