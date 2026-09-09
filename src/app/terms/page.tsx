import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | MoneyXprt',
  description: 'MoneyXprt Terms of Service.',
};

/** Renders MoneyXprt's public terms of service without requiring authentication. */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0d1f15] px-6 py-10 text-white sm:px-10 sm:py-14">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white px-6 py-8 text-[#172219] shadow-sm sm:px-10 sm:py-12">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0d1f15] underline underline-offset-4 hover:text-[#a37d2c]">← Back to MoneyXprt</Link>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">MoneyXprt Terms of Service</h1>
        <p className="mt-3 text-sm font-semibold text-gray-600">Last updated: September 8, 2026</p>
        <div className="mt-8 space-y-5 text-base leading-7 text-gray-700">
          <p>Please read these Terms of Service (&quot;Terms&quot;) carefully before using MoneyXprt (the &quot;Service&quot;), available at moneyxprt.com. By creating an account or using the Service, you agree to these Terms.</p>
          <p>MoneyXprt is currently offered on a limited, invitation-only basis during active development and testing. Features, calculations, and availability may change without notice during this period.</p>
          <TermsSection title="1. What MoneyXprt Is — and Is Not"><p>MoneyXprt is a self-service financial planning and organization tool. It is designed to help you organize your financial information, model scenarios, and identify tax strategies that may be relevant to your situation.</p><p><strong>MoneyXprt is not a financial advisor, tax advisor, accountant, attorney, or broker-dealer.</strong> We do not provide personalized financial, investment, tax, or legal advice. Nothing in the Service constitutes a recommendation to buy, sell, or hold any investment, or to take any specific tax position. Every calculation, projection, and strategy suggestion in the Service is a general, automated estimate based on the information you enter — it is not a substitute for advice from a licensed professional who knows your complete financial and legal situation.</p><p><strong>You are solely responsible for verifying any strategy, deduction, or calculation with a qualified CPA, tax attorney, or financial advisor before relying on it or acting on it, including for tax filing purposes.</strong></p></TermsSection>
          <TermsSection title="2. Eligibility and Accounts"><p>You must be at least 18 years old to use the Service. You are responsible for maintaining the confidentiality of your account access (including your email address used for magic-link sign-in) and for all activity under your account.</p></TermsSection>
          <TermsSection title="3. Your Data"><p>You retain ownership of the financial information you enter into the Service. By using the Service, you grant us the ability to store, process, and display that information back to you as necessary to operate the Service. See our Privacy Policy for how we handle your data.</p><p>You are responsible for the accuracy of the information you enter. Calculations, strategy suggestions, and projections are only as accurate as the data you provide and are estimates, not guarantees.</p></TermsSection>
          <TermsSection title="4. Partner Sharing"><p>If you invite another person to view a shared plan and they accept, you are responsible for the accuracy and appropriateness of the financial information shared with them through that feature.</p></TermsSection>
          <TermsSection title="5. Disclaimers"><p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p><p>We do not warrant that the Service will be uninterrupted, error-free, or that any calculation, projection, tax strategy suggestion, or freedom-date estimate will be accurate, complete, or suitable for your circumstances. Tax laws, contribution limits, and deduction thresholds change over time and vary by individual circumstances; figures displayed in the Service may not reflect the most current law at all times.</p></TermsSection>
          <TermsSection title="6. Limitation of Liability"><p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, MONEYXPRT AND ITS OPERATOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, TAX PENALTIES, INTEREST, AUDIT COSTS, OR FINANCIAL LOSS ARISING FROM YOUR USE OF, OR RELIANCE ON, THE SERVICE — INCLUDING ANY TAX STRATEGY, DEDUCTION ESTIMATE, OR FINANCIAL PROJECTION DISPLAYED BY THE SERVICE — EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p><p>Because the Service is provided during active development, it may contain errors, and calculated figures may be corrected or change as bugs are identified and fixed.</p></TermsSection>
          <TermsSection title="7. Prohibited Use"><p>You agree not to: use the Service for any unlawful purpose; attempt to access another user&apos;s data without authorization; attempt to interfere with, disrupt, or gain unauthorized access to the Service&apos;s systems or infrastructure; or reverse-engineer the Service.</p></TermsSection>
          <TermsSection title="8. Termination"><p>We may suspend or terminate your access to the Service at any time, particularly during this early testing period, for any reason, including if we discontinue the Service. You may stop using the Service and request account deletion at any time by contacting us.</p></TermsSection>
          <TermsSection title="9. Changes to the Service and These Terms"><p>Because MoneyXprt is under active development, features, calculations, and these Terms may change. We will update the &quot;Last updated&quot; date when material changes are made. Continued use of the Service after changes are posted constitutes acceptance.</p></TermsSection>
          <TermsSection title="10. Governing Law"><p>These Terms are governed by the laws of the State of California, without regard to conflict-of-law principles.</p></TermsSection>
          <TermsSection title="11. Contact"><p>Questions about these Terms: <strong>ian@moneyxprt.com</strong></p></TermsSection>
        </div>
      </article>
    </main>
  );
}

/** Groups a terms heading with its corresponding legal text. */
function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="pt-3 text-xl font-bold tracking-[-0.02em] text-[#172219]">{title}</h2>{children}</section>;
}
