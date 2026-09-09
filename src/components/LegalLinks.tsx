import Link from 'next/link';

/** Renders compact public links to MoneyXprt's legal documents. */
export function LegalLinks() {
  return (
    <nav aria-label="Legal" className="flex items-center justify-center gap-4 text-sm text-white/55">
      <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-[#d4a843]">Privacy</Link>
      <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-[#d4a843]">Terms</Link>
    </nav>
  );
}
