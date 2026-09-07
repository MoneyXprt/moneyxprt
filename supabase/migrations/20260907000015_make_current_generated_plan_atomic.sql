-- Browser/session promotion requires the target plan to belong to auth.uid().
-- Advisory locking serializes concurrent regenerations for the same account.
CREATE OR REPLACE FUNCTION public.make_generated_plan_current(target_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  caller_user_id uuid := auth.uid();
BEGIN
  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to promote a generated plan.';
  END IF;

  SELECT user_id
    INTO target_user_id
    FROM public.generated_plans
    WHERE id = target_plan_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Generated plan not found.';
  END IF;

  IF caller_user_id <> target_user_id THEN
    RAISE EXCEPTION 'You cannot update another user''s generated plan.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(target_user_id::text));

  UPDATE public.generated_plans
    SET is_current = false
    WHERE user_id = target_user_id
      AND is_current = true
      AND id <> target_plan_id;

  UPDATE public.generated_plans
    SET is_current = true
    WHERE id = target_plan_id
      AND user_id = target_user_id;

  RETURN target_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.make_generated_plan_current(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.make_generated_plan_current(uuid) TO authenticated;

-- This RPC is deliberately inaccessible to browser roles. It is used only by
-- trusted API routes that authenticate the acting user and authorize the target
-- account before constructing a service-role Supabase client.
CREATE OR REPLACE FUNCTION public.make_generated_plan_current_as_service_role(target_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT user_id
    INTO target_user_id
    FROM public.generated_plans
    WHERE id = target_plan_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Generated plan not found.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(target_user_id::text));

  UPDATE public.generated_plans
    SET is_current = false
    WHERE user_id = target_user_id
      AND is_current = true
      AND id <> target_plan_id;

  UPDATE public.generated_plans
    SET is_current = true
    WHERE id = target_plan_id
      AND user_id = target_user_id;

  RETURN target_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.make_generated_plan_current_as_service_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.make_generated_plan_current_as_service_role(uuid) TO service_role;
