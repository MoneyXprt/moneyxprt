-- Revoke authenticated/anon access accidentally granted via schema default
-- privileges on function creation. make_generated_plan_current_as_service_role
-- has no per-call ownership check by design (trusts its service-role caller);
-- it must never be reachable from a browser session.
REVOKE EXECUTE ON FUNCTION public.make_generated_plan_current_as_service_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.make_generated_plan_current_as_service_role(uuid) FROM anon;

-- Prevent this from recurring: stop granting execute on new public-schema
-- functions to anon/authenticated by default. Functions that need those
-- roles must GRANT explicitly, same pattern as correct_debt_record and
-- make_generated_plan_current already do.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
