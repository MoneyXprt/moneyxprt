-- Accepting an invitation changes both the invitation and the inviter's shared
-- profile. Keep them in a single transaction so they cannot diverge.
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(invitation_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation public.partner_invitations%ROWTYPE;
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF caller_id IS NULL OR caller_email = '' THEN
    RAISE EXCEPTION 'Authentication is required to accept an invitation.';
  END IF;

  SELECT * INTO invitation
  FROM public.partner_invitations
  WHERE token = invitation_token
  FOR UPDATE;

  IF NOT FOUND OR invitation.accepted THEN
    RAISE EXCEPTION 'Invitation is invalid or already accepted.';
  END IF;
  IF invitation.inviter_user_id = caller_id THEN
    RAISE EXCEPTION 'You cannot accept your own invitation.';
  END IF;
  IF lower(trim(invitation.invitee_email)) <> caller_email THEN
    RAISE EXCEPTION 'Use the email address that received this invitation.';
  END IF;

  UPDATE public.freedom_profiles
  SET partner_user_id = caller_id,
      partner_accepted = true
  WHERE user_id = invitation.inviter_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The inviter no longer has a shareable plan.';
  END IF;

  UPDATE public.partner_invitations
  SET accepted = true
  WHERE id = invitation.id;

  RETURN invitation.inviter_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_partner_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_partner_invitation(text) TO authenticated;
