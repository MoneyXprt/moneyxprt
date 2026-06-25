'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Constants ────────────────────────────────────────────────────────────────

type RiskLevel = 'conservative' | 'moderate' | 'aggressive';
type ConstraintKey =
  | 'spouse_works_full_time'
  | 'cannot_manage_property'
  | 'retirement_accounts_only'
  | 'significant_debt'
  | 'not_accredited'
  | 'stay_liquid_12mo';

const RISK_OPTIONS: { value: RiskLevel; title: string; description: string }[] = [
  {
    value: 'conservative',
    title: 'Conservative',
    description: 'I prioritize protecting what I have. Slower growth is fine if it\'s stable.',
  },
  {
    value: 'moderate',
    title: 'Moderate',
    description: 'I can handle some volatility for better long-term returns.',
  },
  {
    value: 'aggressive',
    title: 'Aggressive',
    description: 'I\'m focused on maximum growth. I can stomach significant swings.',
  },
];

const HARD_CONSTRAINTS: { key: ConstraintKey; label: string; subtext: string }[] = [
  {
    key: 'spouse_works_full_time',
    label: 'My spouse works full time',
    subtext: 'Affects REPS eligibility for rental depreciation offset',
  },
  {
    key: 'cannot_manage_property',
    label: "I can't manage property actively",
    subtext: 'Filters out short-term rental recommendations',
  },
  {
    key: 'retirement_accounts_only',
    label: "I'm not able to invest outside retirement accounts right now",
    subtext: 'Limits plan to 401k, IRA, and HSA strategies',
  },
  {
    key: 'significant_debt',
    label: 'I have significant debt to address first',
    subtext: 'Plan will sequence debt paydown before asset acquisition',
  },
  {
    key: 'not_accredited',
    label: "I'm not accredited",
    subtext: 'Limits syndication access — generally $200K+ income or $1M+ net worth',
  },
  {
    key: 'stay_liquid_12mo',
    label: 'I want to stay fully liquid for the next 12 months',
    subtext: 'Removes illiquid asset classes from near-term recommendations',
  },
];

// ─── Shared slider style (injected once) ─────────────────────────────────────

const SLIDER_CSS = `
  .plan-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; width: 100%; }
  .plan-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; border-radius: 50%; background: #059669; border: 3px solid white; box-shadow: 0 2px 8px rgba(5,150,105,0.35); cursor: pointer; }
  .plan-slider::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #059669; border: 3px solid white; box-shadow: 0 2px 8px rgba(5,150,105,0.35); cursor: pointer; }
`;

function sliderGradient(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, #059669 0%, #059669 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/constraints` },
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Almost there.</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">Sign in to complete your plan.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, helper, children }: {
  title: string; helper?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
      {helper && <p className="text-xs text-gray-400 leading-relaxed mb-4">{helper}</p>}
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConstraintsPage() {
  const router = useRouter();
  const [session, setSession]             = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Form state
  const [capitalPerYear, setCapitalPerYear] = useState(12_000);
  const [hoursPerWeek,   setHoursPerWeek]   = useState(5);
  const [riskTolerance,  setRiskTolerance]  = useState<RiskLevel>('moderate');
  const [constraints,    setConstraints]    = useState<Set<ConstraintKey>>(new Set());

  const [saving,   setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Session + pre-populate ────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) {
        const { data } = await sb
          .from('user_constraints')
          .select('capital_per_year, hours_per_week, risk_tolerance, hard_constraints')
          .eq('user_id', s.user.id)
          .maybeSingle();
        if (data) {
          setCapitalPerYear(Number(data.capital_per_year));
          setHoursPerWeek(Number(data.hours_per_week));
          setRiskTolerance(data.risk_tolerance as RiskLevel);
          if (Array.isArray(data.hard_constraints)) {
            setConstraints(new Set(data.hard_constraints as ConstraintKey[]));
          }
        }
      }
    });
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange(
      (_e, s) => setSession(s),
    );
    return () => subscription.unsubscribe();
  }, []);

  const toggleConstraint = (key: ConstraintKey) => {
    setConstraints(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session) return;
    setSaving(true); setSaveError(null);
    try {
      const { error } = await getBrowserSupabaseClient()
        .from('user_constraints')
        .upsert({
          user_id:          session.user.id,
          capital_per_year: capitalPerYear,
          hours_per_week:   hoursPerWeek,
          risk_tolerance:   riskTolerance,
          hard_constraints: Array.from(constraints),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      router.push('/dashboard/plan');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{SLIDER_CSS}</style>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest leading-none">
                Step 5 of 5 — Constraints
              </p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                Final step
              </span>
            </div>
            <p className="text-xs text-gray-400">Build Your Plan</p>
          </div>
          {/* All 5 pills filled */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${
                i < 5 ? 'w-5 bg-emerald-500' : 'w-5 bg-emerald-400'
              }`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-10 space-y-4">

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almost there.</h1>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
            Last step. Tell us what you&apos;re working with and we&apos;ll build around it.
          </p>
        </div>

        {/* ── Section 1: Capital ────────────────────────────────────────── */}
        <Section
          title="How much can you deploy toward assets each year?"
          helper="After expenses, debt payments, and emergency fund — what's left to invest?"
        >
          {/* Big value display */}
          <div className="text-center mb-5">
            <p className="text-4xl font-extrabold text-emerald-600 tabular-nums leading-none">
              ${capitalPerYear.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mt-1">per year</p>
          </div>

          <input
            type="range"
            min={0}
            max={100_000}
            step={1_000}
            value={capitalPerYear}
            onChange={e => setCapitalPerYear(Number(e.target.value))}
            className="plan-slider"
            style={{ background: sliderGradient(capitalPerYear, 0, 100_000) }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-[11px] text-gray-400">$0 — building toward it</span>
            <span className="text-[11px] text-gray-400">$25K</span>
            <span className="text-[11px] text-gray-400">$100K+</span>
          </div>
        </Section>

        {/* ── Section 2: Time ───────────────────────────────────────────── */}
        <Section
          title="How many hours per week can you invest in building?"
          helper="Active management, research, networking — not passive investing time."
        >
          <div className="text-center mb-5">
            <p className="text-4xl font-extrabold text-emerald-600 tabular-nums leading-none">
              {hoursPerWeek}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {hoursPerWeek === 1 ? 'hour' : 'hours'} per week
            </p>
          </div>

          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={hoursPerWeek}
            onChange={e => setHoursPerWeek(Number(e.target.value))}
            className="plan-slider"
            style={{ background: sliderGradient(hoursPerWeek, 0, 20) }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-[11px] text-gray-400">0 — fully passive</span>
            <span className="text-[11px] text-gray-400">5 hrs</span>
            <span className="text-[11px] text-gray-400">20+ hrs</span>
          </div>
        </Section>

        {/* ── Section 3: Risk tolerance ────────────────────────────────── */}
        <Section title="How do you handle investment risk?">
          <div className="flex flex-col gap-3">
            {RISK_OPTIONS.map(opt => {
              const active = riskTolerance === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRiskTolerance(opt.value)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-start gap-3 transition-all active:scale-[0.99] ${
                    active
                      ? 'border-emerald-500 bg-emerald-50/60'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    active ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200'
                  }`}>
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${active ? 'text-emerald-900' : 'text-gray-900'}`}>
                      {opt.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Section 4: Hard constraints ──────────────────────────────── */}
        <Section
          title="Anything that limits your options?"
          helper="Check everything that applies. This prevents the plan from recommending things that won't work for you."
        >
          <div className="flex flex-col gap-2">
            {HARD_CONSTRAINTS.map(item => {
              const checked = constraints.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleConstraint(item.key)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-start gap-3 transition-all active:scale-[0.99] ${
                    checked
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    checked ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'
                  }`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight ${checked ? 'text-emerald-900' : 'text-gray-800'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.subtext}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700">
            {saveError}
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 disabled:opacity-60 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving your plan…</>
            ) : (
              <>Build my freedom plan →</>
            )}
          </button>
          <p className="mt-2.5 text-center text-xs text-gray-400">
            You can update these anytime. Your plan adjusts automatically.
          </p>
        </div>
      </main>
    </div>
  );
}
