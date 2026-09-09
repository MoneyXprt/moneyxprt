-- Retroactive grant cleanup: functions created before the default-privilege
-- fix (see 20260907000016) were auto-granted execute to anon/authenticated
-- regardless of their own REVOKE/GRANT statements. Caught by a full
-- permissions audit; both function bodies are internally safe (require
-- auth.uid() or validate all inputs) but the stray grants should not exist.
REVOKE EXECUTE ON FUNCTION public.accept_partner_invitation(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM anon, authenticated;
