create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'question')),
  message text not null check (char_length(message) between 1 and 2000),
  page_path text not null check (char_length(page_path) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.product_feedback enable row level security;

create policy "Users can submit their own feedback"
  on public.product_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on public.product_feedback for select
  using (auth.uid() = user_id);
