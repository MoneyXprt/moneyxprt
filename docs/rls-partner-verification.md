# RLS and partner-access verification

Use two existing test accounts: **Owner** and **Partner**. Record pass/fail and a screenshot for every step.

## Owner isolation

1. Sign in as Owner and create a uniquely named goal bucket and cash-flow event.
2. Sign in as Partner before accepting an invitation.
3. Confirm Partner cannot see Owner’s net worth, goals, cash-flow events, financial snapshots, generated plans, or execution actions.

## Accepted partnership

1. As Owner, invite Partner from Settings.
2. As Partner, accept the invitation from the email link.
3. Confirm Partner can view Owner’s shared plan and execution actions only.
4. As Partner, mark one Owner execution action complete; confirm Owner sees the completion and attribution.
5. Confirm Partner still cannot view or edit Owner’s financial snapshots, actuals, goal buckets, investment check-ins, or cash-flow events.

## Revocation

1. As Owner, remove the partner connection in Settings.
2. As Partner, reload the app.
3. Confirm shared plan and execution access is gone.

Any unexpected read or write is a release blocker. Do not invite alpha users until all steps pass.
