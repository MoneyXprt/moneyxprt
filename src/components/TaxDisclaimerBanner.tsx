/** Displays the shared tax-estimate disclosure in a neutral, readable treatment. */
export function TaxDisclaimerBanner({ text }: { text: string }) {
  return (
    <aside className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5" aria-label="Tax disclaimer">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs leading-relaxed text-gray-600">{text}</p>
    </aside>
  );
}
