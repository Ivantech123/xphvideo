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

-- Create a table for support tickets / reports
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users,
  user_email text,
  status text not null default 'open',
  type text not null default 'report',
  subject text,
  message text,
  video_id text,
  video_title text,
  video_source text,
  video_creator_id text,
  video_creator_name text,
  page_url text,
  admin_notes text,
  resolved_at timestamp with time zone
);

create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute procedure public.set_updated_at();

-- Set up Row Level Security (RLS)
alter table public.support_tickets enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email','') = 'abloko362@gmail.com';
$$;

-- Policy: authenticated users can create tickets
create policy "Users can create support tickets"
  on public.support_tickets for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Policy: users can view their own tickets, admin can view all
create policy "Users can view own tickets or admin all"
  on public.support_tickets for select
  using (public.is_admin() or auth.uid() = user_id);

-- Policy: admin can update tickets
create policy "Admin can update tickets"
  on public.support_tickets for update
  using (public.is_admin())
  with check (public.is_admin());

-- Policy: admin can delete tickets
create policy "Admin can delete tickets"
  on public.support_tickets for delete
  using (public.is_admin());
