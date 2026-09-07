-- Shared, server-only rate limiting for AI endpoints across Vercel instances.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows (
  rate_limit_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz;
  current_count integer;
  now_at timestamptz := now();
BEGIN
  IF p_key = '' OR p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  INSERT INTO public.api_rate_limit_windows (rate_limit_key, window_started_at, request_count)
  VALUES (p_key, now_at, 0)
  ON CONFLICT (rate_limit_key) DO NOTHING;

  SELECT window_started_at, request_count
  INTO current_window, current_count
  FROM public.api_rate_limit_windows
  WHERE rate_limit_key = p_key
  FOR UPDATE;

  IF now_at - current_window >= make_interval(secs => p_window_seconds) THEN
    UPDATE public.api_rate_limit_windows
    SET window_started_at = now_at, request_count = 1
    WHERE rate_limit_key = p_key;
    RETURN QUERY SELECT true, 0;
  ELSIF current_count < p_max_requests THEN
    UPDATE public.api_rate_limit_windows
    SET request_count = request_count + 1
    WHERE rate_limit_key = p_key;
    RETURN QUERY SELECT true, 0;
  ELSE
    RETURN QUERY SELECT false,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_window + make_interval(secs => p_window_seconds) - now_at)))::integer);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
