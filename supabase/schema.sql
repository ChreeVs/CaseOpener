create extension if not exists pgcrypto;

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
  game_type text not null check (game_type in ('coinflip', 'crash', 'jackpot', 'case_battle', 'upgrader')),
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

-- TODO Supabase Edge Functions:
-- 1. settle_coinflip(lobby_id)
-- 2. settle_jackpot(lobby_id)
-- 3. settle_case_battle(lobby_id)
-- 4. settle_upgrader(action_id)
-- These functions must lock stakes, resolve RNG server-side and apply inventory/credit deltas.
