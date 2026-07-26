'use client';

/*
  DB migration — run once in Supabase SQL editor:
  alter table freedom_profiles add column if not exists childhood_dream text;
  alter table freedom_profiles add column if not exists identity_shift text;
  alter table freedom_profiles add column if not exists relationship_impact text;
  alter table freedom_profiles add column if not exists time_use_preference text;
  alter table freedom_profiles add column if not exists cost_of_waiting text;
  alter table freedom_profiles add column if not exists freedom_statement text;
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Constants ────────────────────────────────────────────────────────────────

type FreedomType = 'never_work' | 'work_optional' | 'lower_stress';
type ScreenId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'loading' | 8;

const SLIDER_MIN = 25;
const SLIDER_MAX = 75;
const DEFAULT_TARGET_AGE = 55;
const DEFAULT_CURRENT_AGE = 45;
const GOLD   = '#C9A84C';
const FOREST = '#1B3A2D';

const TIME_USE_OPTIONS = [
  { value: 'Build something',    icon: '🔨', description: 'A business, a project, something that matters' },
  { value: 'Experience things',  icon: '🌍', description: 'Travel, adventure, presence with people I love' },
  { value: 'Give back',          icon: '🤝', description: 'Teach, mentor, contribute to something larger' },
  { value: 'Rest and restore',   icon: '🌿', description: 'Slow down, health, presence, peace' },
  { value: 'A mix of all of it', icon: '✨', description: 'Different seasons, different focus' },
] as const;

function freedomTypeFromPreference(pref: string): FreedomType {
  if (pref === 'Build something' || pref === 'Give back') return 'work_optional';
  if (pref === 'Rest and restore') return 'never_work';
  return 'lower_stress';
}

function buildFallback(visionText: string, timeUse: string, age: number): string {
  const clue = visionText ? visionText.split('.')[0].trim() : 'a different kind of life';
  return `You're building toward ${clue}. By age ${age}, you want ${timeUse.toLowerCase()} to be possible — not someday, but as the actual shape of your days.`;
}

// ─── Shared textarea style ────────────────────────────────────────────────────

const TA_CLASS =
  'w-full rounded-2xl px-4 py-4 text-white text-base leading-relaxed resize-none ' +
  'focus:outline-none transition';
const TA_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1.5px solid rgba(255,255,255,0.18)',
  minHeight: 180,
};

// ─── Auth gate (dark theme) ───────────────────────────────────────────────────

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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: FOREST }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: GOLD }}>
          <svg className="w-5 h-5" style={{ color: FOREST }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Build Your Vision</h1>
        <p className="mt-1 text-sm text-white/50 mb-6">Sign in to start.</p>
        {sent ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: GOLD }}>
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-sm opacity-80">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-white text-sm focus:outline-none transition"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} />
            {err && <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
              style={{ background: GOLD, color: FOREST }}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Shell (dark forest green, 7-step progress) ───────────────────────────────

function Shell({
  screenNum, onBack, fading, children,
}: {
  screenNum: number; onBack?: () => void; fading: boolean; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: FOREST }}>
      <header className="sticky top-0 z-10" style={{ background: FOREST, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <p className="text-xs font-semibold text-white/40 tracking-wide">
              Step {screenNum} of 7
            </p>
          </div>
          {/* Dot progress */}
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300" style={{
                height: 6,
                width: i < screenNum - 1 ? 20 : i === screenNum - 1 ? 20 : 8,
                background: i < screenNum - 1 ? GOLD
                  : i === screenNum - 1 ? '#ffffff'
                  : 'rgba(255,255,255,0.2)',
              }} />
            ))}
          </div>
        </div>
      </header>
      <main
        className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 flex flex-col"
        style={{ transition: 'opacity 0.15s', opacity: fading ? 0 : 1, paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        {children}
      </main>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Heading({ main, sub }: { main: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-white leading-tight">{main}</h1>
      {sub && <p className="mt-1.5 text-base text-white/55 leading-relaxed">{sub}</p>}
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return <p className="text-sm text-white/60 leading-relaxed mb-3">{text}</p>;
}

function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl font-bold text-base transition active:scale-[0.98] disabled:opacity-40"
      style={{ background: GOLD, color: FOREST }}>
      {children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-4 rounded-2xl border text-sm font-medium text-white/60 hover:bg-white/[0.08] transition"
      style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
      ← Back
    </button>
  );
}

// ─── Screen 1 — Childhood dream ───────────────────────────────────────────────

function S1({ value, onChange, onNext }: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading main="Before we talk about money." sub="Think back to when you were 10 years old." />
      <div className="flex-1 flex flex-col gap-3">
        <Prompt text="What did you want to be when you grew up? Not what seemed realistic — the real answer." />
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder="I wanted to be a marine biologist. I used to..."
          className={TA_CLASS} style={{ ...TA_STYLE, flex: 1 }} />
      </div>
      <PrimaryBtn onClick={onNext}>Keep going →</PrimaryBtn>
    </div>
  );
}

// ─── Screen 2 — Perfect Tuesday ───────────────────────────────────────────────

function S2({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading main="Now — your perfect Tuesday." sub="Not a vacation. A regular Tuesday when the job doesn't exist." />
      <div className="flex-1 flex flex-col gap-3">
        <Prompt text="Where are you? What time do you wake up? What's the first thing you do? Write it like it's happening right now." />
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder="I wake up in..."
          className={TA_CLASS} style={{ ...TA_STYLE, flex: 1 }} />
      </div>
      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]"><PrimaryBtn onClick={onNext}>Keep going →</PrimaryBtn></div>
      </div>
    </div>
  );
}

// ─── Screen 3 — Identity shift ────────────────────────────────────────────────

function S3({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading main="Who are you when you're free?" sub="What's different about how you show up?" />
      <div className="flex-1 flex flex-col gap-3">
        <Prompt text="More patient with your kids? Building something you care about? Coaching, creating, traveling? Describe the free version of you." />
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder="I'm more..."
          className={TA_CLASS} style={{ ...TA_STYLE, flex: 1 }} />
      </div>
      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]"><PrimaryBtn onClick={onNext}>Keep going →</PrimaryBtn></div>
      </div>
    </div>
  );
}

// ─── Screen 4 — Relationship impact ──────────────────────────────────────────

function S4({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading main="Who else changes when you're free?" sub="Your spouse, your kids, your friendships." />
      <div className="flex-1 flex flex-col gap-3">
        <Prompt text="What's different for the people you love when the job pressure is gone?" />
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder="My wife..."
          className={TA_CLASS} style={{ ...TA_STYLE, flex: 1 }} />
      </div>
      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]"><PrimaryBtn onClick={onNext}>Keep going →</PrimaryBtn></div>
      </div>
    </div>
  );
}

// ─── Screen 5 — Time use preference ──────────────────────────────────────────

function S5({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading
        main="If your money worked while you slept —"
        sub="How would you actually spend a free Monday?"
      />
      <div className="flex flex-col gap-2.5 flex-1">
        {TIME_USE_OPTIONS.map(opt => {
          const selected = value === opt.value;
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              className="w-full text-left rounded-2xl p-4 flex items-center gap-4 transition active:scale-[0.98]"
              style={{
                background: selected ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${selected ? 'rgba(201,168,76,0.65)' : 'rgba(255,255,255,0.12)'}`,
              }}>
              <span className="text-3xl leading-none shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{opt.value}</p>
                <p className="text-xs text-white/55 mt-0.5 leading-snug">{opt.description}</p>
              </div>
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition"
                style={{
                  background: selected ? GOLD : 'transparent',
                  border: `2px solid ${selected ? GOLD : 'rgba(255,255,255,0.2)'}`,
                }}>
                {selected && (
                  <svg className="w-3 h-3" style={{ color: FOREST }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]">
          <PrimaryBtn onClick={onNext} disabled={!value}>Keep going →</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Screen 6 — Cost of waiting ───────────────────────────────────────────────

function S6({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150); }, []);
  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading
        main="What's the cost of waiting?"
        sub="Every year you stay job-dependent is a year of what you just described that doesn't happen."
      />
      <div className="flex-1 flex flex-col gap-3">
        <Prompt text="What specifically are you missing right now because of the job? Be honest." />
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder="I missed..."
          className={TA_CLASS} style={{ ...TA_STYLE, flex: 1 }} />
      </div>
      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]"><PrimaryBtn onClick={onNext}>Keep going →</PrimaryBtn></div>
      </div>
    </div>
  );
}

// ─── Screen 7 — Age commitment ────────────────────────────────────────────────

function S7({
  targetAge, currentAge, onTargetAge, onCurrentAge, onNext, onBack,
}: {
  targetAge: number; currentAge: number;
  onTargetAge: (v: number) => void; onCurrentAge: (v: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const yearsFromNow = Math.max(0, targetAge - currentAge);
  const pct = ((targetAge - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  let note: { text: string; amber: boolean } | null = null;
  if (yearsFromNow < 5)  note = { text: "That's an aggressive timeline — we'll build the most accelerated plan possible.", amber: true };
  if (yearsFromNow > 15) note = { text: "That gives us real runway to build something substantial.", amber: false };

  return (
    <div className="flex flex-col flex-1 gap-5">
      <Heading
        main="What age do you want to be when that Tuesday becomes your normal?"
        sub="You've just described what you're building toward. Now let's put a date on it."
      />

      {/* Current age stepper */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <span className="text-xs text-white/50 shrink-0">Your age today</span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => onCurrentAge(Math.max(18, currentAge - 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 transition text-base font-bold"
            style={{ border: '1px solid rgba(255,255,255,0.18)' }}>−</button>
          <span className="w-8 text-center text-sm font-bold text-white tabular-nums">{currentAge}</span>
          <button onClick={() => onCurrentAge(Math.min(targetAge - 1, currentAge + 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 transition text-base font-bold"
            style={{ border: '1px solid rgba(255,255,255,0.18)' }}>+</button>
        </div>
      </div>

      {/* Slider card */}
      <div className="rounded-2xl px-6 py-7 flex flex-col items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="text-center">
          <p className="text-[4rem] font-extrabold text-white leading-none tabular-nums">{targetAge}</p>
          <p className="text-sm text-white/40 mt-1">years old</p>
        </div>
        <div className="w-full">
          <style>{`
            .fv-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              width: 28px; height: 28px;
              border-radius: 50%;
              background: ${GOLD};
              border: 3px solid ${FOREST};
              box-shadow: 0 2px 8px rgba(201,168,76,0.5);
              cursor: pointer;
            }
            .fv-slider::-moz-range-thumb {
              width: 28px; height: 28px;
              border-radius: 50%;
              background: ${GOLD};
              border: 3px solid ${FOREST};
              box-shadow: 0 2px 8px rgba(201,168,76,0.5);
              cursor: pointer;
            }
            .fv-slider {
              -webkit-appearance: none; appearance: none;
              height: 6px; border-radius: 9999px;
              outline: none; cursor: pointer;
            }
          `}</style>
          <input type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={1}
            value={targetAge}
            onChange={e => { const v = Number(e.target.value); if (v > currentAge) onTargetAge(v); }}
            className="fv-slider w-full"
            style={{ background: `linear-gradient(to right, ${GOLD} 0%, ${GOLD} ${pct}%, rgba(255,255,255,0.2) ${pct}%, rgba(255,255,255,0.2) 100%)` }} />
          <div className="flex justify-between mt-2">
            <span className="text-[11px] text-white/25">{SLIDER_MIN}</span>
            <span className="text-[11px] text-white/25">{SLIDER_MAX}</span>
          </div>
        </div>
        <p className="text-base font-semibold text-white/80">
          That&apos;s <span className="text-xl font-extrabold text-white">{yearsFromNow}</span>{' '}
          year{yearsFromNow !== 1 ? 's' : ''} from now.
        </p>
      </div>

      {note && (
        <div className="rounded-xl px-4 py-3 text-xs leading-relaxed" style={{
          background: note.amber ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${note.amber ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
          color: note.amber ? '#FCD34D' : '#6EE7B7',
        }}>{note.text}</div>
      )}

      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <div className="flex-[2]">
          <PrimaryBtn onClick={onNext}>Build my freedom statement →</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FreedomVisionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFresh = searchParams?.get('fresh') === 'true';

  const [session, setSession]           = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [screen, setScreen]             = useState<ScreenId>(1);
  const [fading, setFading]             = useState(false);
  const [existingRowId, setExistingRowId] = useState<string | null>(null);

  // Field state
  const [childhoodDream,      setChildhoodDream]      = useState('');
  const [visionText,          setVisionText]           = useState('');
  const [identityShift,       setIdentityShift]        = useState('');
  const [relationshipImpact,  setRelationshipImpact]   = useState('');
  const [timeUsePreference,   setTimeUsePreference]    = useState('');
  const [costOfWaiting,       setCostOfWaiting]        = useState('');
  const [currentAge,          setCurrentAge]           = useState(DEFAULT_CURRENT_AGE);
  const [targetAge,           setTargetAge]            = useState(DEFAULT_TARGET_AGE);
  const [generatedStatement,  setGeneratedStatement]   = useState('');

  // ── Auth + data load ────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (!s) return;

      const { data } = await sb
        .from('freedom_profiles')
        .select('id, vision_text, target_free_age, current_age, childhood_dream, identity_shift, relationship_impact, time_use_preference, cost_of_waiting')
        .eq('user_id', s.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;
      setExistingRowId(data.id as string);

      // Skip pre-population if coming from a rebuild
      if (isFresh) return;

      if (data.childhood_dream)     setChildhoodDream(data.childhood_dream as string);
      if (data.vision_text)         setVisionText(data.vision_text as string);
      if (data.identity_shift)      setIdentityShift(data.identity_shift as string);
      if (data.relationship_impact) setRelationshipImpact(data.relationship_impact as string);
      if (data.time_use_preference) setTimeUsePreference(data.time_use_preference as string);
      if (data.cost_of_waiting)     setCostOfWaiting(data.cost_of_waiting as string);
      if (data.target_free_age)     setTargetAge(Number(data.target_free_age));
      if (data.current_age != null) setCurrentAge(Number(data.current_age));
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fade transition helper ──────────────────────────────────────────────────
  const goTo = useCallback((next: ScreenId) => {
    setFading(true);
    setTimeout(() => { setScreen(next); setFading(false); }, 150);
  }, []);

  // ── Final submit ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!session) return;
    goTo('loading');

    const sb      = getBrowserSupabaseClient();
    const userId  = session.user.id;
    const fType   = freedomTypeFromPreference(timeUsePreference);

    const corePayload = {
      user_id:              userId,
      vision_text:          visionText.trim() || null,
      target_free_age:      targetAge,
      current_age:          currentAge,
      freedom_type:         fType,
      childhood_dream:      childhoodDream.trim() || null,
      identity_shift:       identityShift.trim() || null,
      relationship_impact:  relationshipImpact.trim() || null,
      time_use_preference:  timeUsePreference || null,
      cost_of_waiting:      costOfWaiting.trim() || null,
    };

    let rowId = existingRowId;
    try {
      if (existingRowId) {
        await sb.from('freedom_profiles').update(corePayload).eq('id', existingRowId).eq('user_id', userId);
      } else {
        const { data: newRow } = await sb
          .from('freedom_profiles')
          .insert(corePayload)
          .select('id')
          .single();
        rowId = (newRow as { id: string } | null)?.id ?? null;
        if (rowId) setExistingRowId(rowId);
      }
    } catch {
      // DB save failed — still proceed to generate statement
    }

    // Generate freedom statement
    let statement = buildFallback(visionText, timeUsePreference, targetAge);
    try {
      const res = await fetch('/api/generate-freedom-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childhood_dream:      childhoodDream,
          vision_text:          visionText,
          identity_shift:       identityShift,
          relationship_impact:  relationshipImpact,
          time_use_preference:  timeUsePreference,
          cost_of_waiting:      costOfWaiting,
          target_free_age:      targetAge,
        }),
      });
      const json = await res.json() as { freedom_statement?: string };
      if (json.freedom_statement) statement = json.freedom_statement;
    } catch {
      // Use fallback — already set
    }

    // Save freedom statement to DB
    if (rowId) {
      try {
        await sb.from('freedom_profiles').update({ freedom_statement: statement }).eq('id', rowId);
      } catch {
        // Non-blocking
      }
    }

    setGeneratedStatement(statement);
    goTo(8);
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: FOREST }}>
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: '#fff' }} />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: FOREST }}>
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: GOLD }} />
        <p className="text-white/60 text-sm">Writing your freedom statement...</p>
      </div>
    );
  }

  // ── Reflection screen (Screen 8) ─────────────────────────────────────────────
  if (screen === 8) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 py-12" style={{ background: FOREST }}>
        <div className="w-full max-w-sm">
          <p className="text-white italic text-xl leading-relaxed text-center font-light mb-6"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            &ldquo;{generatedStatement}&rdquo;
          </p>
          <p className="text-center text-sm font-semibold mb-12" style={{ color: GOLD }}>
            This is what you&apos;re building toward.
          </p>
          <PrimaryBtn onClick={() => router.push('/dashboard/freedom-calculator' + (isFresh ? '?fresh=true' : ''))}>
            Continue to your freedom number →
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── 7 guided screens ────────────────────────────────────────────────────────
  const screenNum = screen as number;

  return (
    <Shell screenNum={screenNum} fading={fading}
      onBack={screenNum > 1 ? () => goTo((screenNum - 1) as ScreenId) : undefined}>
      {screen === 1 && (
        <S1 value={childhoodDream} onChange={setChildhoodDream}
          onNext={() => goTo(2)} />
      )}
      {screen === 2 && (
        <S2 value={visionText} onChange={setVisionText}
          onNext={() => goTo(3)} onBack={() => goTo(1)} />
      )}
      {screen === 3 && (
        <S3 value={identityShift} onChange={setIdentityShift}
          onNext={() => goTo(4)} onBack={() => goTo(2)} />
      )}
      {screen === 4 && (
        <S4 value={relationshipImpact} onChange={setRelationshipImpact}
          onNext={() => goTo(5)} onBack={() => goTo(3)} />
      )}
      {screen === 5 && (
        <S5 value={timeUsePreference} onChange={setTimeUsePreference}
          onNext={() => goTo(6)} onBack={() => goTo(4)} />
      )}
      {screen === 6 && (
        <S6 value={costOfWaiting} onChange={setCostOfWaiting}
          onNext={() => goTo(7)} onBack={() => goTo(5)} />
      )}
      {screen === 7 && (
        <S7
          targetAge={targetAge} currentAge={currentAge}
          onTargetAge={setTargetAge} onCurrentAge={setCurrentAge}
          onNext={handleSubmit} onBack={() => goTo(6)}
        />
      )}
    </Shell>
  );
}
