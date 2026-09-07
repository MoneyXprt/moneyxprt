import type { FinancialObservation } from '@/app/lib/financialObservations';

interface NetWorthHistoryProps {
  observations: FinancialObservation[];
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Shows recent recorded net-worth values and their movement over time. */
export function NetWorthHistory({ observations }: NetWorthHistoryProps) {
  const recent = observations.slice(-6).reverse();
  if (recent.length === 0) {
    return <p className="text-sm text-gray-500">Your first check-in becomes the starting point for this trend.</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {recent.map((observation, index) => {
        const previous = recent[index + 1];
        const difference = previous ? observation.value - previous.value : null;
        return (
          <div key={observation.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-gray-800">{formatDate(observation.observedOn)}</p>
              {difference !== null && (
                <p className={`text-xs ${difference >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {difference >= 0 ? '+' : '−'}${Math.abs(Math.round(difference)).toLocaleString('en-US')} since prior check-in
                </p>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              ${Math.round(observation.value).toLocaleString('en-US')}
            </p>
          </div>
        );
      })}
    </div>
  );
}
