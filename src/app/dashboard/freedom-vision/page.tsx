'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type FreedomType = 'never_work' | 'work_optional' | 'lower_stress';

const FREEDOM_OPTIONS: {
  value: FreedomType;
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  {
    value: 'never_work',
    title: 'Never work again',
    description: 'Full stop. Assets cover everything. The job is done.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12a8.96 8.96 0 00.287 2.253" />
      </svg>
    ),
  },
  {
    value: 'work_optional',
    title: 'Work only when I want',
    description: 'Freedom to choose. You might work — but only on your terms, your schedule, your projects.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    ),
  },
  {
    value: 'lower_stress',
    title: 'Lower stress, different work',
    description: 'You want out of the grind. Less pressure, more meaning, same or less income needed.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
];

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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/freedom-vision` },
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
        <h1 className="text-xl font-semibold text-gray-900">Build Your Plan</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">Sign in to start your freedom vision.</p>
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

// ─── Shared shell ─────────────────────────────────────────────────────────────

function Shell({
  screen, totalScreens, onBack, children,
}: {
  screen: number; totalScreens: number; onBack?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest leading-none">
                Step 1 of 5 — Vision
              </p>
              <p className="text-xs text-gray-400">Build Your Plan</p>
            </div>
          </div>
          {/* Pill progress */}
          <div className="flex gap-1">
            {Array.from({ length: totalScreens }).map((_, i) => (
              <div key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < screen ? 'w-5 bg-emerald-500' : i === screen - 1 ? 'w-5 bg-emerald-400' : 'w-2 bg-gray-200'
                }`} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        {children}
      </main>
    </div>
  );
}

// ─── Screen 1 — Vision text ───────────────────────────────────────────────────

function Screen1({
  value, onChange, onNext,
}: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);

  return (
    <div className="flex flex-col flex-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Let&apos;s start with your why.</h1>
        <p className="mt-2 text-base text-gray-500 leading-relaxed">
          Describe your free life. Where are you? What does a Tuesday look like when you don&apos;t have to work?
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="I'm in Carlsbad. I wake up without an alarm. I surf in the morning, work on things I care about in the afternoon, and coach my kid's team on weekends..."
          className="flex-1 w-full min-h-[220px] px-4 py-4 rounded-2xl border-2 border-gray-200 text-gray-900 text-base leading-relaxed placeholder-gray-300 focus:border-emerald-500 focus:outline-none resize-none transition"
        />
        <p className="mt-2.5 text-xs text-gray-400 leading-relaxed px-1">
          This isn&apos;t a financial question. Write what actually comes to mind.
          We&apos;ll use this to build a plan that&apos;s worth executing.
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-700 active:scale-[0.98] transition"
      >
        That&apos;s my vision →
      </button>
    </div>
  );
}

// ─── Screen 2 — Timeline slider ───────────────────────────────────────────────

const SLIDER_MIN = 25;
const SLIDER_MAX = 75;
const DEFAULT_TARGET_AGE = 55;
const DEFAULT_CURRENT_AGE = 45;

function Screen2({
  targetAge, currentAge, onTargetAge, onCurrentAge, onNext, onBack,
}: {
  targetAge: number; currentAge: number;
  onTargetAge: (v: number) => void; onCurrentAge: (v: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const yearsFromNow = Math.max(0, targetAge - currentAge);
  const pct = ((targetAge - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  let timelineNote: { text: string; color: string } | null = null;
  if (yearsFromNow < 5) {
    timelineNote = {
      text: "That's an aggressive timeline — we'll build the most accelerated plan possible.",
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    };
  } else if (yearsFromNow > 15) {
    timelineNote = {
      text: "That gives us real runway to build something substantial.",
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }

  return (
    <div className="flex flex-col flex-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">When does this happen?</h1>
        <p className="mt-2 text-base text-gray-500 leading-relaxed">
          Pick the age you want to be financially free by. Not retired — free. Working optional.
        </p>
      </div>

      {/* Current age control */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <span className="text-xs text-gray-500 shrink-0">Your age today</span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => onCurrentAge(Math.max(18, currentAge - 1))}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-base font-bold">−</button>
          <span className="w-8 text-center text-sm font-bold text-gray-900 tabular-nums">{currentAge}</span>
          <button onClick={() => onCurrentAge(Math.min(targetAge - 1, currentAge + 1))}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-base font-bold">+</button>
        </div>
      </div>

      {/* Slider card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-7 flex flex-col items-center gap-6">
        {/* Big age display */}
        <div className="text-center">
          <p className="text-[4rem] font-extrabold text-gray-900 leading-none tabular-nums">{targetAge}</p>
          <p className="text-sm text-gray-400 mt-1">years old</p>
        </div>

        {/* Slider */}
        <div className="w-full relative">
          <style>{`
            .freedom-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              width: 28px; height: 28px;
              border-radius: 50%;
              background: #059669;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(5,150,105,0.4);
              cursor: pointer;
            }
            .freedom-slider::-moz-range-thumb {
              width: 28px; height: 28px;
              border-radius: 50%;
              background: #059669;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(5,150,105,0.4);
              cursor: pointer;
            }
            .freedom-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; }
          `}</style>
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={targetAge}
            onChange={e => {
              const v = Number(e.target.value);
              if (v > currentAge) onTargetAge(v);
            }}
            className="freedom-slider w-full"
            style={{
              background: `linear-gradient(to right, #059669 0%, #059669 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
            }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-[11px] text-gray-300">{SLIDER_MIN}</span>
            <span className="text-[11px] text-gray-300">{SLIDER_MAX}</span>
          </div>
        </div>

        {/* Years from now */}
        <div className="text-center">
          <p className="text-lg font-semibold text-emerald-600">
            That&apos;s <span className="text-2xl font-extrabold">{yearsFromNow}</span>{' '}
            year{yearsFromNow !== 1 ? 's' : ''} from now.
          </p>
        </div>
      </div>

      {/* Timeline note */}
      {timelineNote && (
        <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${timelineNote.color}`}>
          {timelineNote.text}
        </div>
      )}

      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          At that age, you&apos;ll need your assets to generate your freedom number every month — without you working.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-4 rounded-2xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
          ← Back
        </button>
        <button onClick={onNext}
          className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-[0.98] transition">
          That&apos;s my timeline →
        </button>
      </div>
    </div>
  );
}

// ─── Screen 3 — Freedom type ──────────────────────────────────────────────────

function Screen3({
  selected, onSelect, onNext, onBack, saving, saveError,
}: {
  selected: FreedomType | null;
  onSelect: (v: FreedomType) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="flex flex-col flex-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">What does freedom actually mean?</h1>
        <p className="mt-2 text-base text-gray-500 leading-relaxed">
          This shapes how we sequence your plan.
        </p>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {FREEDOM_OPTIONS.map(opt => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={`w-full text-left rounded-2xl border-2 p-5 transition-all active:scale-[0.98] ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className={`text-base font-semibold leading-tight ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                    {opt.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{opt.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {saveError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700">{saveError}</div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-4 rounded-2xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!selected || saving}
          className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          {saving
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            : 'This is what I want →'}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FreedomVisionPage() {
  const router = useRouter();
  const [session, setSession]         = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Screen state (1–3)
  const [screen, setScreen] = useState(1);

  // Field state
  const [visionText,   setVisionText]   = useState('');
  const [currentAge,   setCurrentAge]   = useState(DEFAULT_CURRENT_AGE);
  const [targetAge,    setTargetAge]    = useState(DEFAULT_TARGET_AGE);
  const [freedomType,  setFreedomType]  = useState<FreedomType | null>(null);

  // Async state
  const [existingRowId, setExistingRowId] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Session ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) {
        const { data } = await sb
          .from('freedom_profiles')
          .select('id, vision_text, target_free_age, freedom_type')
          .eq('user_id', s.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setExistingRowId(data.id as string);
          if (data.vision_text)    setVisionText(data.vision_text as string);
          if (data.target_free_age) setTargetAge(Number(data.target_free_age));
          if (data.freedom_type)   setFreedomType(data.freedom_type as FreedomType);
        }
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Save & redirect ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session || !freedomType) return;
    setSaving(true); setSaveError(null);

    const payload = {
      vision_text:    visionText.trim() || null,
      target_free_age: targetAge,
      freedom_type:   freedomType,
    };

    try {
      const sb = getBrowserSupabaseClient();
      if (existingRowId) {
        const { error } = await sb
          .from('freedom_profiles')
          .update(payload)
          .eq('id', existingRowId)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('freedom_profiles')
          .insert({ user_id: session.user.id, ...payload });
        if (error) throw error;
      }
      router.push('/dashboard/freedom-calculator');
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
    <Shell
      screen={screen}
      totalScreens={3}
      onBack={screen > 1 ? () => setScreen(s => s - 1) : undefined}
    >
      {screen === 1 && (
        <Screen1
          value={visionText}
          onChange={setVisionText}
          onNext={() => setScreen(2)}
        />
      )}
      {screen === 2 && (
        <Screen2
          targetAge={targetAge}
          currentAge={currentAge}
          onTargetAge={setTargetAge}
          onCurrentAge={setCurrentAge}
          onNext={() => setScreen(3)}
          onBack={() => setScreen(1)}
        />
      )}
      {screen === 3 && (
        <Screen3
          selected={freedomType}
          onSelect={setFreedomType}
          onNext={handleSave}
          onBack={() => setScreen(2)}
          saving={saving}
          saveError={saveError}
        />
      )}
    </Shell>
  );
}
