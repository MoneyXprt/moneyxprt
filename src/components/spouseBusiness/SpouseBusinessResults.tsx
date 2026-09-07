import { useState } from 'react';
import { formatCurrency, formatDate } from '@/app/lib/format';
import type { SpouseBusinessStrategy } from '@/app/lib/calculations/spouseBusiness';

/** Ranked spouse-business recommendations and the single plan CTA. */
export function SpouseBusinessResults({
  strategies,
  saving,
  error,
  onAdd,
}: {
  strategies: readonly SpouseBusinessStrategy[];
  saving: boolean;
  error: string;
  onAdd: () => void;
}) {
  return (
    <section className="pb-28">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Best opportunities</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-gray-900">Your top business strategies</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-gray-500">
        Ranked by estimated annual value using your latest financial snapshot.
      </p>

      {strategies.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          We need a little more financial information before we can rank strategies.
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((strategy) => <StrategyCard key={strategy.id} strategy={strategy} />)}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={saving || strategies.length === 0}
            onClick={onAdd}
            className="min-h-[52px] w-full rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Updating your plan…' : 'Add these to my plan'}
          </button>
        </div>
      </div>
    </section>
  );
}

function StrategyCard({ strategy }: { strategy: SpouseBusinessStrategy }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xl font-bold tabular-nums text-emerald-600">
          {formatCurrency(strategy.annualSavings)}<span className="text-xs font-semibold">/yr</span>
        </p>
        {strategy.deadline && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
            By {formatDate(strategy.deadline)}
          </span>
        )}
      </div>
      <h2 className="mt-3 text-base font-bold text-gray-900">{strategy.name}</h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        {strategy.unlocked ? strategy.description : strategy.unlockCondition}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="mt-2 min-h-[44px] text-sm font-semibold text-emerald-700"
      >
        {expanded ? 'Show less' : 'Learn more'}
      </button>
      {expanded && <p className="border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-500">{strategy.learnMore}</p>}
    </article>
  );
}
