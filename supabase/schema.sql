create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid null references auth.users(id) on delete set null,
  player_name text not null check (char_length(player_name) between 1 and 24),
  team text not null check (team in ('ct', 't')),
  message text not null check (char_length(message) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat read public" on public.chat_messages;
create policy "chat read public"
  on public.chat_messages
  for select
  using (true);

drop policy if exists "chat insert public" on public.chat_messages;
create policy "chat insert public"
  on public.chat_messages
  for insert
  with check (
    char_length(player_name) between 1 and 24
    and team in ('ct', 't')
    and char_length(message) between 1 and 180
  );

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Operatore',
  team text not null default 'ct' check (team in ('ct', 't')),
  prestige integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles owner write" on public.profiles;
create policy "profiles owner write"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.player_states (
  player_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_states enable row level security;

drop policy if exists "player states owner only" on public.player_states;
create policy "player states owner only"
  on public.player_states
  for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create table if not exists public.player_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item jsonb not null,
  locked boolean not null default false,
  escrow_match_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_inventory_owner_idx
  on public.player_inventory (owner_id, created_at desc);

alter table public.player_inventory enable row level security;

drop policy if exists "inventory owner read" on public.player_inventory;
create policy "inventory owner read"
  on public.player_inventory
  for select
  using (auth.uid() = owner_id);

drop policy if exists "inventory owner update" on public.player_inventory;
create policy "inventory owner update"
  on public.player_inventory
  for update
  using (auth.uid() = owner_id and escrow_match_id is null)
  with check (auth.uid() = owner_id);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid not null references public.player_inventory(id) on delete cascade,
  price numeric(12, 2) not null check (price > 0),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists market_listings_status_idx
  on public.market_listings (status, created_at desc);

alter table public.market_listings enable row level security;

drop policy if exists "market active read" on public.market_listings;
create policy "market active read"
  on public.market_listings
  for select
  using (status = 'active' or auth.uid() = seller_id);

drop policy if exists "market seller insert" on public.market_listings;
create policy "market seller insert"
  on public.market_listings
  for insert
  with check (auth.uid() = seller_id);

create table if not exists public.game_lobbies (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('coinflip', 'crash', 'jackpot', 'upgrader')),
  created_by uuid null references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'locked', 'settled', 'cancelled')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz null
);

alter table public.game_lobbies enable row level security;

drop policy if exists "lobbies read public" on public.game_lobbies;
create policy "lobbies read public"
  on public.game_lobbies
  for select
  using (true);

drop policy if exists "lobbies auth create" on public.game_lobbies;
create policy "lobbies auth create"
  on public.game_lobbies
  for insert
  with check (auth.uid() = created_by);

create table if not exists public.game_stakes (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.game_lobbies(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  stake_type text not null check (stake_type in ('credits', 'skin')),
  amount numeric(12, 2) not null default 0,
  inventory_item_id uuid null references public.player_inventory(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.game_stakes enable row level security;

drop policy if exists "stakes participants read" on public.game_stakes;
create policy "stakes participants read"
  on public.game_stakes
  for select
  using (true);

drop policy if exists "stakes auth insert" on public.game_stakes;
create policy "stakes auth insert"
  on public.game_stakes
  for insert
  with check (auth.uid() = player_id);

create table if not exists public.community_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id text not null check (char_length(goal_id) between 1 and 48),
  goal_key text not null check (char_length(goal_key) between 1 and 96),
  scope text not null default 'community' check (scope = 'community'),
  player_id uuid null references auth.users(id) on delete set null,
  player_name text not null default 'Operatore' check (char_length(player_name) between 1 and 24),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  created_at timestamptz not null default now()
);

create index if not exists community_goal_contributions_key_idx
  on public.community_goal_contributions (goal_key, created_at desc);

alter table public.community_goal_contributions enable row level security;

drop policy if exists "community goals read public" on public.community_goal_contributions;
create policy "community goals read public"
  on public.community_goal_contributions
  for select
  using (true);

drop policy if exists "community goals insert public" on public.community_goal_contributions;
create policy "community goals insert public"
  on public.community_goal_contributions
  for insert
  with check (
    scope = 'community'
    and amount > 0
    and amount <= 1000000
    and char_length(goal_id) between 1 and 48
    and char_length(goal_key) between 1 and 96
    and char_length(player_name) between 1 and 24
    and (player_id is null or auth.uid() = player_id)
  );

drop policy if exists "community goals admin reset" on public.community_goal_contributions;
create policy "community goals admin reset"
  on public.community_goal_contributions
  for delete
  using (auth.role() = 'authenticated');

create table if not exists public.community_goal_resets (
  id uuid primary key default gen_random_uuid(),
  goal_id text not null check (char_length(goal_id) between 1 and 48),
  goal_key text not null check (char_length(goal_key) between 1 and 96),
  admin_name text not null default 'Admin' check (char_length(admin_name) between 1 and 24),
  reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists community_goal_resets_key_idx
  on public.community_goal_resets (goal_key, reset_at desc);

alter table public.community_goal_resets enable row level security;

drop policy if exists "community goal resets read public" on public.community_goal_resets;
create policy "community goal resets read public"
  on public.community_goal_resets
  for select
  using (true);

drop policy if exists "community goal resets insert auth" on public.community_goal_resets;
create policy "community goal resets insert auth"
  on public.community_goal_resets
  for insert
  with check (auth.role() = 'authenticated');

create table if not exists public.global_promo_codes (
  code text primary key check (char_length(code) between 3 and 32),
  reward jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.global_promo_codes enable row level security;

drop policy if exists "promo codes read active" on public.global_promo_codes;
create policy "promo codes read active"
  on public.global_promo_codes
  for select
  using (active = true or auth.role() = 'authenticated');

drop policy if exists "promo codes admin insert" on public.global_promo_codes;
create policy "promo codes admin insert"
  on public.global_promo_codes
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "promo codes admin update" on public.global_promo_codes;
create policy "promo codes admin update"
  on public.global_promo_codes
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "promo codes admin delete" on public.global_promo_codes;
create policy "promo codes admin delete"
  on public.global_promo_codes
  for delete
  using (auth.role() = 'authenticated');

create or replace function public.is_caseopener_admin(admin_id text, admin_password text)
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(admin_id, '')) = 'salernitana'
    and encode(extensions.digest(convert_to(coalesce(admin_password, ''), 'UTF8'), 'sha256'), 'hex') = '87fc24cd3eca2c923a3af9916967218edefa6bdc767d72eabef79e86122ae559';
$$;

create or replace function public.admin_reset_community_goals(
  admin_id text,
  admin_password text,
  goal_keys text[]
)
returns setof public.community_goal_resets
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_time timestamptz := now();
begin
  if not public.is_caseopener_admin(admin_id, admin_password) then
    raise exception 'invalid admin credentials';
  end if;

  return query
    insert into public.community_goal_resets (goal_id, goal_key, admin_name, reset_at)
    select
      split_part(key_value, ':', 1),
      key_value,
      'Admin',
      reset_time
    from unnest(goal_keys) as key_value
    where char_length(key_value) between 1 and 96
    returning *;
end;
$$;

create or replace function public.admin_upsert_global_promo_code(
  admin_id text,
  admin_password text,
  promo_code text,
  promo_reward jsonb,
  promo_active boolean default true
)
returns public.global_promo_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  normalized_reward jsonb;
  result public.global_promo_codes;
begin
  if not public.is_caseopener_admin(admin_id, admin_password) then
    raise exception 'invalid admin credentials';
  end if;

  normalized_code := upper(regexp_replace(coalesce(promo_code, ''), '[^A-Za-z0-9_-]', '', 'g'));
  if char_length(normalized_code) < 3 or char_length(normalized_code) > 32 then
    raise exception 'invalid promo code';
  end if;

  normalized_reward := jsonb_build_object(
    'credits', greatest(0, floor(coalesce(nullif(promo_reward->>'credits', '')::numeric, 0))),
    'cases', greatest(0, floor(coalesce(nullif(promo_reward->>'cases', '')::numeric, 0))),
    'rewardTier', least(6, greatest(1, floor(coalesce(nullif(promo_reward->>'rewardTier', '')::numeric, 2)))),
    'weapons', least(24, greatest(0, floor(coalesce(nullif(promo_reward->>'weapons', '')::numeric, 0)))),
    'weaponRarity', coalesce(nullif(promo_reward->>'weaponRarity', ''), 'Mil-Spec')
  );

  insert into public.global_promo_codes (code, reward, active, updated_at)
  values (normalized_code, normalized_reward, coalesce(promo_active, true), now())
  on conflict (code) do update set
    reward = excluded.reward,
    active = excluded.active,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.admin_delete_global_promo_code(
  admin_id text,
  admin_password text,
  promo_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  deleted_code text;
begin
  if not public.is_caseopener_admin(admin_id, admin_password) then
    raise exception 'invalid admin credentials';
  end if;

  normalized_code := upper(regexp_replace(coalesce(promo_code, ''), '[^A-Za-z0-9_-]', '', 'g'));
  delete from public.global_promo_codes
  where code = normalized_code
  returning code into deleted_code;

  return deleted_code is not null;
end;
$$;

grant execute on function public.is_caseopener_admin(text, text) to anon, authenticated;
grant execute on function public.admin_reset_community_goals(text, text, text[]) to anon, authenticated;
grant execute on function public.admin_upsert_global_promo_code(text, text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.admin_delete_global_promo_code(text, text, text) to anon, authenticated;

create table if not exists public.shared_game_events (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (char_length(mode) between 1 and 32),
  game text not null check (char_length(game) between 1 and 48),
  player_name text not null default 'Operatore' check (char_length(player_name) between 1 and 24),
  detail text not null default '' check (char_length(detail) <= 180),
  stake numeric(12, 2) not null default 0,
  payout numeric(12, 2) not null default 0,
  profit numeric(12, 2) not null default 0,
  outcome text not null default '' check (char_length(outcome) <= 64),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shared_game_events_created_at_idx
  on public.shared_game_events (created_at desc);

alter table public.shared_game_events enable row level security;

drop policy if exists "shared game events read public" on public.shared_game_events;
create policy "shared game events read public"
  on public.shared_game_events
  for select
  using (true);

drop policy if exists "shared game events insert public" on public.shared_game_events;
create policy "shared game events insert public"
  on public.shared_game_events
  for insert
  with check (
    char_length(mode) between 1 and 32
    and char_length(game) between 1 and 48
    and char_length(player_name) between 1 and 24
    and char_length(detail) <= 180
  );

create table if not exists public.global_auction_listings (
  id uuid primary key default gen_random_uuid(),
  seller_name text not null default 'Operatore' check (char_length(seller_name) between 1 and 24),
  buyer_name text not null default '' check (char_length(buyer_name) <= 24),
  item jsonb not null,
  price numeric(12, 2) not null check (price > 0 and price <= 1000000),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_auction_listings_status_idx
  on public.global_auction_listings (status, created_at desc);

alter table public.global_auction_listings enable row level security;

drop policy if exists "global auctions read public" on public.global_auction_listings;
create policy "global auctions read public"
  on public.global_auction_listings
  for select
  using (true);

drop policy if exists "global auctions insert public" on public.global_auction_listings;
create policy "global auctions insert public"
  on public.global_auction_listings
  for insert
  with check (
    status = 'active'
    and price > 0
    and price <= 1000000
    and char_length(seller_name) between 1 and 24
  );

drop policy if exists "global auctions update public" on public.global_auction_listings;
create policy "global auctions update public"
  on public.global_auction_listings
  for update
  using (status = 'active')
  with check (status in ('sold', 'cancelled'));

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.chat_messages;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.community_goal_contributions;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.community_goal_resets;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.shared_game_events;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.global_auction_listings;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.global_promo_codes;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- TODO Supabase Edge Functions:
-- 1. settle_coinflip(lobby_id)
-- 2. settle_jackpot(lobby_id)
-- 3. settle_upgrader(action_id)
-- These functions must lock stakes, resolve RNG server-side and apply inventory/credit deltas.
