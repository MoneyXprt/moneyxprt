import {
  EXPENSE_CATEGORIES,
  FAMILY_INVOLVEMENT_OPTIONS,
  type FamilyInvolvement,
  type SpouseBusinessExpenseCategory,
} from '@/app/lib/calculations/spouseBusinessConstants';

const optionClass =
  'min-h-[52px] w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition';

/** Screen 1: choose whether the business has sales. */
export function SalesQuestion({
  value,
  onSelect,
}: {
  value: boolean | null;
  onSelect: (value: boolean) => void;
}) {
  return (
    <QuestionFrame title="Is the business making money yet?" hint="Sales count even if the business is still small.">
      <div className="space-y-3">
        <Choice selected={value === true} onClick={() => onSelect(true)}>Yes, we have sales</Choice>
        <Choice selected={value === false} onClick={() => onSelect(false)}>Not yet</Choice>
      </div>
    </QuestionFrame>
  );
}

/** Screen 2: capture average monthly revenue. */
export function RevenueQuestion({
  value,
  error,
  onChange,
}: {
  value: number | null;
  error: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <QuestionFrame title="About how much per month?" hint="Use an average month. A close estimate is fine.">
      <label className="relative block">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">$</span>
        <input
          autoFocus
          inputMode="decimal"
          type="number"
          min="0"
          step="1"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'revenue-error' : undefined}
          placeholder="1,000"
          className="min-h-[58px] w-full rounded-xl border border-gray-200 bg-white pl-10 pr-16 text-xl font-bold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">/month</span>
      </label>
      {error && <p id="revenue-error" className="mt-2 text-sm text-red-600">{error}</p>}
    </QuestionFrame>
  );
}

/** Screen 3: capture every expense category that applies. */
export function ExpensesQuestion({
  values,
  onToggle,
}: {
  values: readonly SpouseBusinessExpenseCategory[];
  onToggle: (value: SpouseBusinessExpenseCategory) => void;
}) {
  return (
    <QuestionFrame title="What does the business spend money on?" hint="Choose all that apply.">
      <div className="space-y-2">
        {EXPENSE_CATEGORIES.map((option) => (
          <Choice key={option.id} selected={values.includes(option.id)} onClick={() => onToggle(option.id)}>
            <span className="mr-3" aria-hidden="true">{option.emoji}</span>{option.label}
          </Choice>
        ))}
      </div>
    </QuestionFrame>
  );
}

/** Screen 4: capture who helps operate the business. */
export function HelpersQuestion({
  value,
  onSelect,
}: {
  value: FamilyInvolvement | null;
  onSelect: (value: FamilyInvolvement) => void;
}) {
  return (
    <QuestionFrame title="Does anyone help with the business?" hint="This can unlock family tax strategies.">
      <div className="space-y-3">
        {FAMILY_INVOLVEMENT_OPTIONS.map((option) => (
          <Choice key={option.id} selected={value === option.id} onClick={() => onSelect(option.id)}>
            <span className="mr-3" aria-hidden="true">{option.emoji}</span>{option.label}
          </Choice>
        ))}
      </div>
    </QuestionFrame>
  );
}

function QuestionFrame({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-bold leading-tight text-gray-900">{title}</h1>
      <p className="mb-7 mt-2 text-sm leading-relaxed text-gray-500">{hint}</p>
      {children}
    </section>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${optionClass} ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{children}</span>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'}`}>
          {selected && <span aria-hidden="true">✓</span>}
        </span>
      </span>
    </button>
  );
}
