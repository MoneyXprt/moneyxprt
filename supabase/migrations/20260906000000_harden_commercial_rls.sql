-- Commercial-readiness hardening: owner writes and invite confidentiality.

DROP POLICY IF EXISTS "Users can update own snapshots" ON public.financial_snapshots;
CREATE POLICY "Users can update own snapshots"
  ON public.financial_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own actions" ON public.execution_actions;
CREATE POLICY "Users can delete own actions"
  ON public.execution_actions FOR DELETE
  USING (auth.uid() = user_id);

-- Invitation tokens are capabilities. Do not expose the invitation table to every
-- anonymous client; the API returns only the minimal metadata for a supplied token.
DROP POLICY IF EXISTS "Public can read invitation by token" ON public.partner_invitations;
