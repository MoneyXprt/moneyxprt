'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialParticipationLog {
  id: string;
  date: string;
  hours_logged: number;
  description: string;
  irs_category: string;
  created_at: string;
}

// ─── IRS category → badge colour ─────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { pill: string; dot: string }> = {
  'Real estate professional activity':
    { pill: 'bg-blue-50 text-blue-700 ring-blue-200',       dot: 'bg-blue-500' },
  'Active management – rental real estate':
    { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  'More than 500 hours':
    { pill: 'bg-violet-50 text-violet-700 ring-violet-200',  dot: 'bg-violet-500' },
  'More than 100 hours – no other participant exceeds':
    { pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200',  dot: 'bg-indigo-500' },
  'Significant participation activity':
    { pill: 'bg-amber-50 text-amber-700 ring-amber-200',     dot: 'bg-amber-500' },
  'Substantially all participation':
    { pill: 'bg-teal-50 text-teal-700 ring-teal-200',        dot: 'bg-teal-500' },
  'Personal service activity':
    { pill: 'bg-rose-50 text-rose-700 ring-rose-200',        dot: 'bg-rose-500' },
  'Historical material participation (5 of prior 10 years)':
    { pill: 'bg-orange-50 text-orange-700 ring-orange-200',  dot: 'bg-orange-500' },
  'Historical material participation – personal service (any 3 prior years)':
    { pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200',        dot: 'bg-cyan-500' },
  'Other – document separately':
    { pill: 'bg-gray-100 text-gray-600 ring-gray-200',       dot: 'bg-gray-400' },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] ?? CATEGORY_STYLES['Other – document separately'];
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[40, 20, 200, 120].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div
            className="h-3.5 rounded-full bg-gray-100 animate-pulse"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sb = getBrowserSupabaseClient();
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/logs` },
    });
    setLoading(false);
    if (err) { setError(err.message); } else { setSent(true); }
  };

  // Listen for auth state changes (magic link redirect)
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, session) => {
      if (session) onSession(session);
    });
    return () => subscription.unsubscribe();
  }, [onSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 mb-4">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Sign in to continue</h1>
          <p className="mt-1 text-sm text-gray-500">
            We&apos;ll send a one-click sign-in link to your inbox.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">A magic link was sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialParticipationLogsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Voice log input state
  const [rawLog, setRawLog] = useState('');
  const [mockRecording, setMockRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<MaterialParticipationLog | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Logs list state
  const [logs, setLogs] = useState<MaterialParticipationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  // ── Session init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    if (!session) return;
    setLogsLoading(true);
    setLogsError(null);
    const sb = getBrowserSupabaseClient();
    const { data, error } = await sb
      .from('material_participation_logs')
      .select('id, date, hours_logged, description, irs_category, created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      setLogsError(error.message);
    } else {
      setLogs(data as MaterialParticipationLog[]);
    }
    setLogsLoading(false);
  }, [session]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Submit voice log ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !rawLog.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch('/api/parse-voice-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ raw_log: rawLog.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.details
          ? `${json.error}: ${(json.details as string[]).join(', ')}`
          : (json?.error ?? 'Something went wrong. Please try again.');
        setSubmitError(msg);
      } else {
        setSubmitSuccess(json.log as MaterialParticipationLog);
        setRawLog('');
        // Prepend the new log without a full refetch
        setLogs(prev => [json.log as MaterialParticipationLog, ...prev]);
      }
    } catch {
      setSubmitError('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mock recording toggle ──────────────────────────────────────────────────
  const toggleRecording = () => {
    setMockRecording(prev => {
      if (!prev) {
        // Focus the textarea when "recording" starts
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
      return !prev;
    });
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await getBrowserSupabaseClient().auth.signOut();
  };

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours_logged), 0);
  const currentYear = new Date().getFullYear();
  const ytdHours = logs
    .filter(l => l.date.startsWith(String(currentYear)))
    .reduce((sum, l) => sum + Number(l.hours_logged), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthGate onSession={setSession} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300 text-sm">/</span>
            <span className="text-sm text-gray-500">Material Participation</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[180px]">
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-500 hover:text-gray-900 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Page heading + stats ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Material Participation Logs
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              IRS §469 — log and classify your participation hours for audit defense.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <StatPill label={`${currentYear} YTD`} value={`${ytdHours.toFixed(1)} hrs`} accent="indigo" />
            <StatPill label="All time" value={`${totalHours.toFixed(1)} hrs`} accent="gray" />
          </div>
        </div>

        {/* ── Voice log input card ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Log an activity</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Paste or type your raw voice note — Claude will extract the hours, write an
              audit-ready description, and assign the correct IRS category.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Textarea + mic button */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={rawLog}
                onChange={e => setRawLog(e.target.value)}
                placeholder={
                  mockRecording
                    ? 'Recording… type or paste your note here.'
                    : 'e.g. "Spent about 3 hours this morning showing unit 4B to prospective tenants, handled lease renewals for units 2A and 3C, and reviewed contractor bids for the roof repair on my rental property on Maple St."'
                }
                rows={5}
                maxLength={4000}
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition leading-relaxed"
              />
              {/* Character counter */}
              <span className="absolute bottom-3 right-3 text-[11px] text-gray-300 select-none pointer-events-none">
                {rawLog.length}/4000
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-3">
              {/* Mock mic button */}
              <button
                type="button"
                onClick={toggleRecording}
                aria-label={mockRecording ? 'Stop recording' : 'Start recording'}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all
                  ${mockRecording
                    ? 'bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100'
                    : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100'}
                `}
              >
                <span className={`relative flex h-2 w-2 ${mockRecording ? 'block' : 'hidden'}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <MicIcon recording={mockRecording} />
                {mockRecording ? 'Stop recording' : 'Voice note'}
              </button>

              <div className="flex items-center gap-2">
                {rawLog.trim() && (
                  <button
                    type="button"
                    onClick={() => { setRawLog(''); setSubmitError(null); setSubmitSuccess(null); }}
                    className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || !rawLog.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Parsing…
                    </>
                  ) : (
                    <>
                      <SparkleIcon />
                      Parse &amp; save
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Feedback banners */}
            {submitError && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-700 leading-relaxed">{submitError}</p>
              </div>
            )}
            {submitSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved — {submitSuccess.hours_logged}h on {formatDate(submitSuccess.date)}
                </p>
                <p className="text-xs text-emerald-600 leading-relaxed pl-5">{submitSuccess.description}</p>
              </div>
            )}
          </form>
        </div>

        {/* ── Logs table card ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Activity history</h2>
              {!logsLoading && !logsError && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                </p>
              )}
            </div>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              title="Refresh"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <svg className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {logsError ? (
            <div className="px-5 py-6 text-sm text-red-600 bg-red-50">{logsError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-32">Date</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-20">Hours</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Description</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-56">IRS Category</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center">
                        <div className="inline-flex flex-col items-center gap-2 text-gray-400">
                          <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="text-sm">No logs yet — add your first entry above.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const style = getCategoryStyle(log.irs_category);
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-5 py-4 text-gray-500 text-xs tabular-nums whitespace-nowrap">
                            {formatDate(log.date)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="font-semibold text-gray-900 tabular-nums">
                              {Number(log.hours_logged).toFixed(1)}
                            </span>
                            <span className="text-gray-400 text-xs ml-0.5">h</span>
                          </td>
                          <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed max-w-sm">
                            {log.description}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${style.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                              {log.irs_category}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── IRS reference legend ─────────────────────────────────────── */}
        <details className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
            <span className="text-xs font-medium text-gray-500">IRS §469 category reference</span>
            <svg
              className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(CATEGORY_STYLES).map(([cat, style]) => (
              <div key={cat} className="flex items-start gap-2.5">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                <span className="text-xs text-gray-500 leading-relaxed">{cat}</span>
              </div>
            ))}
          </div>
        </details>
      </main>
    </div>
  );
}

// ─── Tiny inline SVG components ───────────────────────────────────────────────

function MicIcon({ recording }: { recording: boolean }) {
  return recording ? (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent }: { label: string; value: string; accent: 'indigo' | 'gray' }) {
  const colors = accent === 'indigo'
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-100'
    : 'bg-gray-50 text-gray-600 ring-gray-100';
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl ring-1 ${colors}`}>
      <span className="text-lg font-bold leading-none tabular-nums">{value}</span>
      <span className="text-[11px] opacity-70 mt-0.5">{label}</span>
    </div>
  );
}
