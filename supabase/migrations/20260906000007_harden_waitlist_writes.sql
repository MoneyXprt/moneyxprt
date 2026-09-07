-- The public waitlist is written only by the server-side /api/waitlist route.
-- The service-role key used by that route bypasses these grants; browsers do not.
revoke insert on table public.waitlist from anon, authenticated;
