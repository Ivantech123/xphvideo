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
drop policy if exists "Users can insert their own subscriptions" on public.subscriptions;
create policy "Users can insert their own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own subscriptions
drop policy if exists "Users can delete their own subscriptions" on public.subscriptions;
create policy "Users can delete their own subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- Policy: Users can view their own subscriptions
drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
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

-- Enable Realtime for tickets (best-effort)
do $$
begin
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email','') = 'abloko362@gmail.com';
$$;

-- Policy: authenticated users can create tickets
drop policy if exists "Users can create support tickets" on public.support_tickets;
create policy "Users can create support tickets"
  on public.support_tickets for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Policy: users can view their own tickets, admin can view all
drop policy if exists "Users can view own tickets or admin all" on public.support_tickets;
create policy "Users can view own tickets or admin all"
  on public.support_tickets for select
  using (public.is_admin() or auth.uid() = user_id);

-- Policy: admin can update tickets
drop policy if exists "Admin can update tickets" on public.support_tickets;
create policy "Admin can update tickets"
  on public.support_tickets for update
  using (public.is_admin())
  with check (public.is_admin());

-- Policy: admin can delete tickets
drop policy if exists "Admin can delete tickets" on public.support_tickets;
create policy "Admin can delete tickets"
  on public.support_tickets for delete
  using (public.is_admin());

-- Search engine: video catalog + Postgres FTS + trigram
do $$
begin
  begin
    execute 'create extension if not exists pg_trgm';
  exception
    when insufficient_privilege then null;
    when undefined_file then null;
  end;

  begin
    execute 'create extension if not exists unaccent';
  exception
    when insufficient_privilege then null;
    when undefined_file then null;
  end;
end $$;

create table if not exists public.videos_catalog (
  id text primary key,
  source text,
  title text,
  description text,
  thumbnail text,
  embed_url text,
  video_url text,
  duration integer,
  creator_id text,
  creator_name text,
  creator_avatar text,
  tags text[] not null default '{}',
  views bigint,
  rating numeric,
  quality text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  search_vector tsvector
);

alter table public.videos_catalog enable row level security;

drop policy if exists "Public can read videos catalog" on public.videos_catalog;
create policy "Public can read videos catalog"
  on public.videos_catalog for select
  using (true);

drop policy if exists "Admin can insert videos catalog" on public.videos_catalog;
create policy "Admin can insert videos catalog"
  on public.videos_catalog for insert
  with check (public.is_admin());

drop policy if exists "Admin can update videos catalog" on public.videos_catalog;
create policy "Admin can update videos catalog"
  on public.videos_catalog for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can delete videos catalog" on public.videos_catalog;
create policy "Admin can delete videos catalog"
  on public.videos_catalog for delete
  using (public.is_admin());

create index if not exists videos_catalog_updated_at_idx on public.videos_catalog (updated_at desc);
create index if not exists videos_catalog_source_idx on public.videos_catalog (source);
create index if not exists videos_catalog_creator_id_idx on public.videos_catalog (creator_id);
create index if not exists videos_catalog_tags_gin on public.videos_catalog using gin (tags);

-- Trigram indexes for typo-tolerant matching
create index if not exists videos_catalog_title_trgm_idx on public.videos_catalog using gin (title gin_trgm_ops);
create index if not exists videos_catalog_creator_name_trgm_idx on public.videos_catalog using gin (creator_name gin_trgm_ops);

-- Keep updated_at fresh for catalog
drop trigger if exists videos_catalog_set_updated_at on public.videos_catalog;
create trigger videos_catalog_set_updated_at
before update on public.videos_catalog
for each row execute procedure public.set_updated_at();

-- Compute search_vector for FTS
create or replace function public.videos_catalog_set_search_vector()
returns trigger
language plpgsql
as $$
declare
  tags_text text;
begin
  tags_text := array_to_string(coalesce(new.tags, '{}'::text[]), ' ');
  new.search_vector :=
    setweight(to_tsvector('simple', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.creator_name, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(tags_text, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.description, ''))), 'C');
  return new;
end;
$$;

drop trigger if exists videos_catalog_search_vector_trigger on public.videos_catalog;
create trigger videos_catalog_search_vector_trigger
before insert or update of title, description, creator_name, tags
on public.videos_catalog
for each row execute procedure public.videos_catalog_set_search_vector();

create index if not exists videos_catalog_search_vector_gin on public.videos_catalog using gin (search_vector);

-- Enable Realtime for catalog (optional, best-effort)
do $$
begin
  begin
    alter publication supabase_realtime add table public.videos_catalog;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- RPC: ranked search (FTS + trigram), optional tag filtering
create or replace function public.search_videos(
  q text,
  tag_filters text[] default null,
  lim integer default 24,
  off integer default 0
)
returns table (
  id text,
  source text,
  title text,
  description text,
  thumbnail text,
  embed_url text,
  video_url text,
  duration integer,
  creator_id text,
  creator_name text,
  creator_avatar text,
  tags text[],
  views bigint,
  rating numeric,
  quality text,
  published_at timestamp with time zone,
  score real
)
language sql
stable
as $$
  with params as (
    select
      nullif(trim(coalesce(q, '')), '') as qq,
      coalesce(tag_filters, '{}'::text[]) as tf
  ),
  base as (
    select v.*,
      (
        case
          when (select qq from params) is null then 0
          else ts_rank_cd(v.search_vector, websearch_to_tsquery('simple', unaccent((select qq from params))))
        end
      )::real as fts_score,
      (
        case
          when (select qq from params) is null then 0
          else greatest(
            similarity(unaccent(coalesce(v.title,'')), unaccent((select qq from params))),
            similarity(unaccent(coalesce(v.creator_name,'')), unaccent((select qq from params)))
          )
        end
      )::real as trgm_score
    from public.videos_catalog v
    where (
      (select array_length(tf, 1) from params) is null
      or (select array_length(tf, 1) from params) = 0
      or v.tags && (select tf from params)
    )
    and (
      (select qq from params) is null
      or v.search_vector @@ websearch_to_tsquery('simple', unaccent((select qq from params)))
      or similarity(unaccent(coalesce(v.title,'')), unaccent((select qq from params))) > 0.2
      or similarity(unaccent(coalesce(v.creator_name,'')), unaccent((select qq from params))) > 0.2
    )
  )
  select
    id, source, title, description, thumbnail, embed_url, video_url, duration,
    creator_id, creator_name, creator_avatar, tags, views, rating, quality, published_at,
    (fts_score * 1.0 + trgm_score * 0.35)::real as score
  from base
  order by score desc nulls last, published_at desc nulls last, updated_at desc
  limit greatest(lim, 1)
  offset greatest(off, 0);
$$;

create table if not exists public.catalog_sync_runs (
  id uuid default gen_random_uuid() primary key,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  finished_at timestamp with time zone,
  status text not null default 'running',
  params jsonb,
  fetched integer not null default 0,
  upserted integer not null default 0,
  error_count integer not null default 0,
  errors jsonb,
  notes text
);

create index if not exists catalog_sync_runs_started_at_idx on public.catalog_sync_runs (started_at desc);
create index if not exists catalog_sync_runs_status_idx on public.catalog_sync_runs (status);

alter table public.catalog_sync_runs enable row level security;

drop policy if exists "Admin can read catalog sync runs" on public.catalog_sync_runs;
create policy "Admin can read catalog sync runs"
  on public.catalog_sync_runs for select
  using (public.is_admin());

drop policy if exists "Admin can insert catalog sync runs" on public.catalog_sync_runs;
create policy "Admin can insert catalog sync runs"
  on public.catalog_sync_runs for insert
  with check (public.is_admin());

drop policy if exists "Admin can update catalog sync runs" on public.catalog_sync_runs;
create policy "Admin can update catalog sync runs"
  on public.catalog_sync_runs for update
  using (public.is_admin())
  with check (public.is_admin());

-- Catalog stats (includes estimates for large tables)
create or replace function public.get_catalog_stats()
returns jsonb
language plpgsql
stable
as $$
declare
  est_rows bigint;
  exact_rows bigint;
  newest timestamp with time zone;
  oldest timestamp with time zone;
  updated_24h bigint;
  by_source jsonb;
  last_run jsonb;
begin
  select coalesce(n_live_tup::bigint, 0) into est_rows
  from pg_stat_all_tables
  where schemaname = 'public' and relname = 'videos_catalog';

  begin
    execute 'select count(*)::bigint, max(updated_at), min(updated_at), count(*) filter (where updated_at > now() - interval ''24 hours'')::bigint from public.videos_catalog'
      into exact_rows, newest, oldest, updated_24h;
  exception
    when undefined_table then
      exact_rows := 0;
      newest := null;
      oldest := null;
      updated_24h := 0;
  end;

  begin
    execute 'select jsonb_object_agg(coalesce(source, ''unknown''), cnt) from (select source, count(*)::bigint as cnt from public.videos_catalog group by source) s'
      into by_source;
  exception
    when undefined_table then
      by_source := '{}'::jsonb;
  end;

  select to_jsonb(r) into last_run
  from (
    select id, started_at, finished_at, status, fetched, upserted, error_count
    from public.catalog_sync_runs
    order by started_at desc
    limit 1
  ) r;

  return jsonb_build_object(
    'estimated_rows', est_rows,
    'exact_rows', exact_rows,
    'newest_updated_at', newest,
    'oldest_updated_at', oldest,
    'updated_last_24h', updated_24h,
    'by_source', coalesce(by_source, '{}'::jsonb),
    'last_run', coalesce(last_run, 'null'::jsonb)
  );
end;
$$;

create table if not exists public.legal_documents (
  id uuid default gen_random_uuid() primary key,
  slug text not null,
  lang text not null default 'en',
  title text,
  content_html text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (slug, lang)
);

create index if not exists legal_documents_slug_idx on public.legal_documents (slug);
create index if not exists legal_documents_updated_at_idx on public.legal_documents (updated_at desc);

drop trigger if exists legal_documents_set_updated_at on public.legal_documents;
create trigger legal_documents_set_updated_at
before update on public.legal_documents
for each row execute procedure public.set_updated_at();

alter table public.legal_documents enable row level security;

drop policy if exists "Lawyer/admin can read legal documents" on public.legal_documents;
create policy "Lawyer/admin can read legal documents"
  on public.legal_documents for select
  using (
    public.is_admin()
    or coalesce(auth.jwt() ->> 'email','') = '8272@mail.ru'
  );

drop policy if exists "Lawyer/admin can insert legal documents" on public.legal_documents;
create policy "Lawyer/admin can insert legal documents"
  on public.legal_documents for insert
  with check (
    public.is_admin()
    or coalesce(auth.jwt() ->> 'email','') = '8272@mail.ru'
  );

drop policy if exists "Lawyer/admin can update legal documents" on public.legal_documents;
create policy "Lawyer/admin can update legal documents"
  on public.legal_documents for update
  using (
    public.is_admin()
    or coalesce(auth.jwt() ->> 'email','') = '8272@mail.ru'
  )
  with check (
    public.is_admin()
    or coalesce(auth.jwt() ->> 'email','') = '8272@mail.ru' git status
git add -A
git commit -m "Feat: ExoClick ads + verify file + privacy blur + feed fixes"
git push origin main
  );

drop policy if exists "Lawyer/admin can delete legal documents" on public.legal_documents;
create policy "Lawyer/admin can delete legal documents"
  on public.legal_documents for delete
  using (
    public.is_admin()
    or coalesce(auth.jwt() ->> 'email','') = '8272@mail.ru'
  );
