-- Partner / spouse shared access
-- Run in Supabase Dashboard SQL Editor:
--   https://supabase.com/dashboard/project/ayeckgcillxfivvnyhaj/sql/new

-- 1. Partner columns on freedom_profiles
alter table freedom_profiles add column if not exists partner_email    text;
alter table freedom_profiles add column if not exists partner_user_id  uuid references auth.users;
alter table freedom_profiles add column if not exists partner_accepted boolean default false;

-- 2. Attribute who checked off each action
alter table execution_actions add column if not exists completed_by_user_id uuid references auth.users;

-- 3. Partner invitations table (from Part 1 of the spec)
create table if not exists partner_invitations (
  id              uuid primary key default gen_random_uuid(),
  inviter_user_id uuid references auth.users not null,
  invitee_email   text not null,
  token           text not null unique default gen_random_uuid()::text,
  accepted        boolean default false,
  created_at      timestamptz default now()
);

alter table partner_invitations enable row level security;

-- Inviter can manage their own invitations (insert / update / delete / select)
create policy "Users can manage own invitations"
  on partner_invitations for all
  using (auth.uid() = inviter_user_id);

-- Public SELECT so the accept-invite page can look up by token
-- (the token UUID itself is the capability / secret)
create policy "Public can read invitation by token"
  on partner_invitations for select
  using (true);

-- 4. Allow a connected partner to read the primary user's freedom_profiles row
--    (used to discover the partnership and show the partner banner)
create policy "Partner can read inviter profile"
  on freedom_profiles for select
  using (partner_user_id = auth.uid() and partner_accepted = true);

-- 5. Allow partner to read primary user's current plan
create policy "Partners can read linked plans"
  on generated_plans for select
  using (
    exists (
      select 1 from freedom_profiles
      where freedom_profiles.user_id = generated_plans.user_id
        and freedom_profiles.partner_user_id = auth.uid()
        and freedom_profiles.partner_accepted = true
    )
  );

-- 6. Allow partner to read primary user's execution actions
create policy "Partners can read linked actions"
  on execution_actions for select
  using (
    exists (
      select 1 from freedom_profiles
      where freedom_profiles.user_id = execution_actions.user_id
        and freedom_profiles.partner_user_id = auth.uid()
        and freedom_profiles.partner_accepted = true
    )
  );

-- 7. Allow partner to check off (update) primary user's execution actions
create policy "Partners can update linked actions"
  on execution_actions for update
  using (
    exists (
      select 1 from freedom_profiles
      where freedom_profiles.user_id = execution_actions.user_id
        and freedom_profiles.partner_user_id = auth.uid()
        and freedom_profiles.partner_accepted = true
    )
  );
