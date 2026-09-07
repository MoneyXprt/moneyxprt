# MoneyXprt launch sequence

The recommended launch is a controlled rollout, not a feature-complete public release. The tax and freedom projections are useful planning estimates, but they should not be marketed as individualized financial, legal, or tax advice.

## Gate 0 — production controls

Complete these before inviting anyone outside the internal test group:

1. Apply every migration from `20260906000000_harden_commercial_rls.sql` through `20260906000011_create_atomic_partner_invitation_acceptance.sql`, in filename order.
2. Verify RLS with two test accounts: each can read and change only its own records; a partner can access only an accepted shared plan.
3. Set production OpenAI spend alerts. AI, CPA-report, partner-plan, market-data, and public-waitlist limits are shared through Supabase so they apply across Vercel instances.
4. Publish privacy, terms, and an advice/disclaimer review with qualified counsel before collecting customer financial data.
5. Run a production build and a manual mobile pass at 375px for onboarding, Audit, Execute, Actuals, Net Worth, Goals, Investments, Cash Flow, partner invite, and CPA report.
6. Confirm the public waitlist accepts a valid address, rejects malformed input, and stops direct browser writes after the waitlist migration is applied.

Exit criteria: every migration is recorded in Supabase, no cross-account read/write succeeds, and the production environment has only production secrets.

## Gate 1 — private alpha (5–10 users)

Invite people who will give direct feedback and who can tolerate data corrections. Keep the scope to onboarding, audit, plan, execution, actuals, and the CPA report. Do not charge yet.

Measure activation as: completed snapshot, generated plan, and one execution action completed within seven days. Interview every user who fails one of those steps. Review every tax-strategy output with a CPA before using it as evidence of accuracy.

Exit criteria: at least 70% reach a generated plan, at least 40% complete one execution action, and no unresolved access-control or calculation defects are open.

## Gate 2 — paid design-partner beta (25–50 users)

Offer a clearly labeled beta with concierge support and an easy way to correct data. Charge only after users receive a complete plan and execution workflow; avoid annual commitments until retention is understood.

Instrument the funnel: onboarding completion, plan generation, Audit-to-Execute conversion, actuals logging, CPA report generation, and 30-day return rate. Treat strategy values as estimates in product, marketing, and support.

Exit criteria: reliable weekly support load, a repeatable onboarding path, and a measured 30-day return rate that justifies scaling acquisition.

## Gate 3 — public release

Open self-serve sign-up only after the prior gates are met. Add a support SLA, incident response owner, backup/restore test, error monitoring, and a regular review of AI usage and failed requests. Continue validating the new manual tracking loop—net worth, goal buckets, returns, cash flow, and monthly check-ins—before expanding integrations.

Plaid remains after the manual net-worth tracker has proven demand and the consent, security, and support model are ready.
