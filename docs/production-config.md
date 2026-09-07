# Production configuration

Configure these values in the deployment provider's production environment. Do not commit `.env.local` or any secret values.
For local development, copy [`.env.example`](../.env.example) to `.env.local` and fill in your own values.

| Variable | Required | Where it may be used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser and server; public by design, protected by Supabase RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only rate-limit operations and trusted server work |
| `OPENAI_API_KEY` | Yes if AI features are enabled | Server-only narrative, freedom statement, and voice-log routes |
| `FRED_API_KEY` | Yes if the Investments benchmark is enabled | Server-only S&P 500 benchmark route |

## Before enabling production traffic

1. Copy the required variables into the production environment, then redeploy. Variables added after a deploy are not picked up until the next deployment.
2. Confirm the client bundle contains only variables prefixed with `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `FRED_API_KEY` must never use that prefix.
3. Confirm every migration through `20260906000011_create_atomic_partner_invitation_acceptance.sql` is applied in the production Supabase project.
4. Run the partner RLS verification in [rls-partner-verification.md](./rls-partner-verification.md) with two test accounts.
5. Exercise the key production paths: sign up, complete the plan, record actuals, create a goal, submit a cash-flow event, compare investments, generate a CPA report, and confirm an AI route is rate-limited after repeated requests.
6. If the legacy Supabase `ask` Edge Function is deployed, deploy the retired handler from `supabase/functions/ask` (or remove the function) so its old public write path returns `410 Gone`.

## Key rotation

If a server-only key is exposed, rotate it at its provider immediately, update the deployment environment, and redeploy. For the Supabase service-role key, also review logs and revoke any compromised deployment access.
