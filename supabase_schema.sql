-- Create a table for user subscriptions
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  creator_id text not null,
  creator_name text not null,
  creator_avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, creator_id)
);

-- Set up Row Level Security (RLS)
alter table public.subscriptions enable row level security;

-- Policy: Users can insert their own subscriptions
create policy "Users can insert their own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own subscriptions
create policy "Users can delete their own subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- Policy: Users can view their own subscriptions
create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);
