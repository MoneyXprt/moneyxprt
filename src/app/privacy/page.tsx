import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | MoneyXprt',
  description: 'MoneyXprt Privacy Policy.',
};

/** Renders MoneyXprt's public privacy policy without requiring authentication. */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0d1f15] px-6 py-10 text-white sm:px-10 sm:py-14">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white px-6 py-8 text-[#172219] shadow-sm sm:px-10 sm:py-12">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0d1f15] underline underline-offset-4 hover:text-[#a37d2c]">← Back to MoneyXprt</Link>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">MoneyXprt Privacy Policy</h1>
        <p className="mt-3 text-sm font-semibold text-gray-600">Last updated: September 8, 2026</p>
        <div className="mt-8 space-y-5 text-base leading-7 text-gray-700">
          <p>This Privacy Policy describes how MoneyXprt (&quot;MoneyXprt,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects information when you use the MoneyXprt application (the &quot;Service&quot;), available at moneyxprt.com.</p>
          <p>MoneyXprt is currently offered on a limited, invitation-only basis as we develop and test the Service. This policy will be updated as the Service evolves.</p>
          <PolicySection title="1. Who We Are"><p>MoneyXprt is operated by Ian Joachim. Questions about this policy or your data can be sent to <strong>ian@moneyxprt.com</strong>.</p></PolicySection>
          <PolicySection title="2. Information We Collect"><p>Because MoneyXprt is a personal financial planning tool, the information you provide is inherently sensitive. We collect:</p><ul><li><strong>Account information</strong>: your email address, used solely for passwordless (magic link) authentication.</li><li><strong>Financial information you provide</strong>, including but not limited to: income and compensation details, bonus and equity information, debt balances and terms, home value and mortgage details, business income (including a spouse&apos;s or partner&apos;s business), equipment and asset purchases, savings and investment balances, and monthly spending categories.</li><li><strong>Goals and preferences</strong> you enter, such as your target retirement or &quot;freedom&quot; timeline, asset acquisition plans, and lifestyle goals.</li><li><strong>Usage information</strong>, such as which features you use and when, collected to help us understand and improve the Service.</li></ul><p>We do <strong>not</strong> collect Social Security numbers, bank account or routing numbers, or payment card numbers through the Service.</p></PolicySection>
          <PolicySection title="3. How We Use Your Information"><p>We use the information you provide to:</p><ul><li>Calculate and display your personalized financial plan, tax strategy suggestions, debt payoff timeline, and projected &quot;freedom date.&quot;</li><li>Generate reports (such as the CPA export packet) that you may choose to share with your own tax or financial professional.</li><li>Operate account authentication and basic application functionality.</li><li>Improve the Service, diagnose bugs, and understand how features are used.</li></ul><p>We do <strong>not</strong> sell your personal or financial information. We do not use your financial data to serve advertising, and MoneyXprt does not currently display third-party ads.</p></PolicySection>
          <PolicySection title="4. How Your Information Is Stored"><p>Your data is stored using Supabase, a third-party database and authentication provider, which acts as our data processor. Application code and hosting are provided by Vercel. Both providers maintain their own security and data-handling practices; MoneyXprt does not independently verify or guarantee the practices of third-party infrastructure providers beyond selecting providers with industry-standard security controls.</p><p>Access to your data within the Service is restricted so that only you can view or modify your own financial records, enforced through database-level access controls tied to your authenticated account.</p></PolicySection>
          <PolicySection title="5. Sharing With a Partner"><p>If you invite a partner or spouse to view a shared plan, and they accept that invitation, certain plan information becomes visible to them as part of the shared-plan feature. You control whether to send such an invitation.</p></PolicySection>
          <PolicySection title="6. Data Retention and Deletion"><p>We retain your information for as long as your account is active. If you would like your account and associated data deleted, contact <strong>ian@moneyxprt.com</strong> and we will delete your data within a reasonable time, except where retention is required to comply with legal obligations or resolve disputes.</p></PolicySection>
          <PolicySection title="7. Your Rights (California Residents)"><p>If you are a California resident, you may have rights under the California Consumer Privacy Act (CCPA) to know what personal information we hold about you, to request deletion of that information, and to opt out of the sale of personal information. As noted above, we do not sell personal information. To exercise any right under the CCPA, contact <strong>ian@moneyxprt.com</strong>.</p></PolicySection>
          <PolicySection title="8. Security"><p>We take reasonable measures to protect your information, including database-level access restrictions and encrypted connections. However, no method of storage or transmission is completely secure, and we cannot guarantee absolute security.</p></PolicySection>
          <PolicySection title="9. Children&apos;s Privacy"><p>MoneyXprt is not directed to individuals under 18, and we do not knowingly collect information from anyone under 18.</p></PolicySection>
          <PolicySection title="10. Changes to This Policy"><p>We may update this Privacy Policy as the Service develops. Material changes will be reflected by updating the &quot;Last updated&quot; date above. Continued use of the Service after changes are posted constitutes acceptance of the revised policy.</p></PolicySection>
          <PolicySection title="11. Contact"><p>Questions about this policy: <strong>ian@moneyxprt.com</strong></p></PolicySection>
        </div>
      </article>
    </main>
  );
}

/** Groups a policy heading with its corresponding legal text. */
function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="pt-3 text-xl font-bold tracking-[-0.02em] text-[#172219]">{title}</h2>{children}</section>;
}
