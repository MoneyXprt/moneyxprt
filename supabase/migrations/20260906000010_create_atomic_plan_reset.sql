-- Reset the plan-building state in one transaction. Keeping this server-side
-- prevents a browser/network failure from leaving an account partially reset.
CREATE OR REPLACE FUNCTION public.reset_my_plan()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to reset a plan.';
  END IF;

  DELETE FROM public.execution_actions WHERE user_id = current_user_id;
  DELETE FROM public.generated_plans WHERE user_id = current_user_id;
  DELETE FROM public.asset_preferences WHERE user_id = current_user_id;
  DELETE FROM public.user_constraints WHERE user_id = current_user_id;
  DELETE FROM public.plan_assumptions WHERE user_id = current_user_id;
  DELETE FROM public.freedom_profiles WHERE user_id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_my_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_plan() TO authenticated;
