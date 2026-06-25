'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Asset card definitions ───────────────────────────────────────────────────

type AssetId =
  | 'long_term_rental'
  | 'short_term_rental'
  | 'syndication'
  | 'index_investing'
  | 'digital_products'
  | 'private_lending';

interface AssetCard {
  id: AssetId;
  emoji: string;
  title: string;
  description: string;
  stats: { capital: string; time: string; income: string };
  taxNote: string;
  bestFor: string;
}

const ASSETS: AssetCard[] = [
  {
    id: 'long_term_rental',
    emoji: '🏠',
    title: 'Long Term Rental Property',
    description:
      'Buy a property, place a tenant, hire a property manager. Monthly cash flow with minimal involvement once set up.',
    stats: {
      capital: '$60K–$100K down',
      time: 'Low with PM',
      income: '$500–$2,000/mo per property',
    },
    taxNote: 'Pairs with REPS for significant W-2 tax offset via depreciation',
    bestFor: 'High earners with capital who want passive income and tax reduction',
  },
  {
    id: 'short_term_rental',
    emoji: '🏖️',
    title: 'Short Term Rental (Airbnb/VRBO)',
    description:
      'Higher income potential than long term but requires more active management or a co-host.',
    stats: {
      capital: '$60K–$120K down',
      time: 'Medium',
      income: '$1,500–$4,000/mo per property',
    },
    taxNote:
      'Average rental period under 7 days qualifies for different passive activity rules',
    bestFor: 'High earners in tourist markets willing to be more hands-on',
  },
  {
    id: 'syndication',
    emoji: '🏢',
    title: 'Real Estate Syndication',
    description:
      'Invest passively in large commercial or multifamily deals alongside other investors. You provide capital, a sponsor manages everything.',
    stats: {
      capital: '$50K–$100K min',
      time: 'Zero',
      income: '$500–$1,500/mo per investment',
    },
    taxNote:
      'Passive losses may offset passive income — consult your CPA on structure',
    bestFor: 'High earners who want real estate exposure without being a landlord',
  },
  {
    id: 'index_investing',
    emoji: '📈',
    title: 'Index Fund Portfolio',
    description:
      'Consistent long term wealth building through low-cost diversified index funds. The slow but certain engine.',
    stats: {
      capital: 'Any amount',
      time: 'Zero',
      income: '$1,000–$3,000/mo at $300K–$900K invested',
    },
    taxNote:
      'Tax-advantaged accounts (401k, Roth, backdoor Roth) reduce drag significantly',
    bestFor: 'Everyone — this should run alongside every other engine',
  },
  {
    id: 'digital_products',
    emoji: '💻',
    title: 'Digital Products or Content Business',
    description:
      'Build income through expertise — courses, newsletters, software, consulting. High upside, requires time to build.',
    stats: {
      capital: 'Low',
      time: 'High initially, lower at scale',
      income: '$2,000–$20,000+/mo',
    },
    taxNote:
      'Business structure (LLC, S-Corp at scale) unlocks additional tax strategies',
    bestFor:
      'High earners with transferable expertise willing to invest time building',
  },
  {
    id: 'private_lending',
    emoji: '📋',
    title: 'Private Lending / Mortgage Notes',
    description:
      'Lend money secured by real estate. Collect interest payments without owning or managing property.',
    stats: {
      capital: '$25K–$100K',
      time: 'Low',
      income: '$200–$800/mo per note',
    },
    taxNote:
      'Interest income is ordinary income — less tax-efficient than equity-based assets',
    bestFor:
      'High earners who want real estate exposure with no landlord responsibilities',
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/asset-preferences` },
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Asset Preferences</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">Sign in to continue building your plan.</p>
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

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-xs text-gray-700 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCardComponent({
  card, selected, onToggle,
}: {
  card: AssetCard; selected: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-150 active:scale-[0.99] ${
        selected
          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      {/* Top row: emoji + title + checkmark */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl leading-none shrink-0 mt-0.5" role="img" aria-label={card.title}>
          {card.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold leading-tight ${selected ? 'text-emerald-900' : 'text-gray-900'}`}>
            {card.title}
          </p>
        </div>
        {/* Checkmark */}
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200'
        }`}>
          {selected && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{card.description}</p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-gray-100">
        <StatPill
          icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Capital"
          value={card.stats.capital}
        />
        <StatPill
          icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Time"
          value={card.stats.time}
        />
        <StatPill
          icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
          label="Income"
          value={card.stats.income}
        />
      </div>

      {/* Tax note */}
      <div className="flex items-start gap-2 mb-3">
        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        <p className="text-xs text-indigo-700 leading-relaxed">{card.taxNote}</p>
      </div>

      {/* Best for */}
      <div className="flex items-start gap-2">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-600">Best for: </span>{card.bestFor}
        </p>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssetPreferencesPage() {
  const router = useRouter();
  const [session, setSession]             = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [selected, setSelected] = useState<Set<AssetId>>(new Set());
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Session + pre-populate ────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) {
        const { data } = await sb
          .from('asset_preferences')
          .select('asset_type')
          .eq('user_id', s.user.id)
          .eq('selected', true);
        if (data?.length) {
          setSelected(new Set(data.map(r => r.asset_type as AssetId)));
        }
      }
    });
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange(
      (_e, s) => setSession(s),
    );
    return () => subscription.unsubscribe();
  }, []);

  const toggle = (id: AssetId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session || selected.size === 0) return;
    setSaving(true); setSaveError(null);
    try {
      const sb = getBrowserSupabaseClient();

      // Re-read the user from the live session to avoid stale-closure issues
      const { data: { user }, error: authErr } = await sb.auth.getUser();
      if (authErr || !user) throw new Error('Session expired — please sign in again.');
      const userId = user.id;

      const selectedArray = Array.from(selected);
      console.log('[asset-preferences/save] userId:', userId);
      console.log('[asset-preferences/save] selected count:', selectedArray.length, '— ids:', selectedArray);

      // Delete all existing rows for this user first (replace-on-revisit)
      const { error: deleteError } = await sb
        .from('asset_preferences')
        .delete()
        .eq('user_id', userId);
      console.log('[asset-preferences/save] delete error:', deleteError?.message ?? 'none');
      if (deleteError) throw deleteError;

      // Build the rows array and log before inserting
      const rows = selectedArray.map(asset_type => ({
        user_id:    userId,
        asset_type,
        selected:   true,
      }));
      console.log('[asset-preferences/save] inserting rows:', JSON.stringify(rows));

      const { data: inserted, error: insertError } = await sb
        .from('asset_preferences')
        .insert(rows)
        .select('asset_type');
      console.log('[asset-preferences/save] inserted:', inserted);
      console.log('[asset-preferences/save] insert error:', insertError?.message ?? 'none');
      if (insertError) throw insertError;

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

  const count = selected.size;
  const canSubmit = count > 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest leading-none">
              Step 4 of 5 — Asset Preferences
            </p>
            <p className="text-xs text-gray-400">Build Your Plan</p>
          </div>
          {/* Step pills */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${
                i < 4 ? 'w-5 bg-emerald-500' : i === 4 ? 'w-5 bg-emerald-400' : 'w-2 bg-gray-200'
              }`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-36">

        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Which income engines are you open to?
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Not what you have — what you&apos;re willing to pursue. Select everything that feels possible.
            Your plan will be built around what you choose.
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4">
          {ASSETS.map(card => (
            <AssetCardComponent
              key={card.id}
              card={card}
              selected={selected.has(card.id)}
              onToggle={() => toggle(card.id)}
            />
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed px-4">
          You&apos;re not committing to anything. This tells us what to include in your plan.
          You can change these anytime.
        </p>

        {saveError && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700">
            {saveError}
          </div>
        )}
      </main>

      {/* ── Sticky CTA ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-4 z-20">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="shrink-0">
            {count > 0 ? (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                {count}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400 text-sm font-bold">
                0
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 leading-none">
              {count === 0
                ? 'Select at least one engine to continue'
                : count === 1
                  ? '1 engine selected'
                  : `${count} engines selected`}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            ) : (
              <>Build my plan →</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
