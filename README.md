# MoneyXprt

MoneyXprt helps high-income W-2 earners build, execute, and track a practical financial-freedom plan. It includes tax-strategy planning, execution actions, actuals, net-worth tracking, goal buckets, investment performance, cash-flow planning, partner access, and CPA-ready reports.

## Local setup

1. Use Node.js 20.9 or newer.
2. Copy [`.env.example`](./.env.example) to `.env.local` and provide your own values. Never commit `.env.local`.
3. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required Supabase setup

Apply the migrations in `supabase/migrations/` in filename order. For the current release, this includes every migration through `20260906000011_create_atomic_partner_invitation_acceptance.sql`.

Before inviting users, complete the two-account verification in [the partner RLS runbook](./docs/rls-partner-verification.md).

## Validation

```bash
npm run lint
npm test -- --run
npx tsc --noEmit
npm run build
```

`npm run build` uses Next.js 16 with Webpack, the production build path verified for this project.

## Production

See [production configuration](./docs/production-config.md) and [the launch sequence](./docs/launch-sequence.md) before enabling customer traffic. Financial, tax, and investment figures are planning estimates; the product should not be represented as individualized financial, legal, or tax advice.
