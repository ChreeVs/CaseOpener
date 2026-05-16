# Supabase Free Setup

## 1. Create Project

1. Go to `https://supabase.com/dashboard`.
2. Create a new free project.
3. Save:
   - Project URL
   - `anon public` key

Do not use or publish the `service_role` key.

## 2. Create Database Tables

Open Supabase:

```text
SQL Editor -> New query
```

Paste and run:

```text
supabase/schema.sql
```

This creates:

- persistent global chat
- profiles
- cloud save table
- inventory table
- marketplace table
- lobby/stake tables for future multiplayer

## 3. Enable Realtime for Chat

In Supabase:

```text
Database -> Replication / Publications
```

Enable Realtime/Postgres changes for:

```text
chat_messages
```

Supabase Realtime/Postgres changes are disabled by default on new projects, so this step is required for live chat updates.

## 4. Configure Frontend

Edit:

```text
src/config/supabaseConfig.js
```

Set:

```js
export const SUPABASE_CONFIG = {
  enabled: true,
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

Commit and push:

```bash
git add src/config/supabaseConfig.js supabase/schema.sql docs/SUPABASE_FREE_SETUP.md
git commit -m "Configure Supabase free backend"
git push
```

## 5. Current Free Online Features

After this setup:

- GitHub Pages hosts the game.
- Supabase stores chat messages.
- Supabase Realtime updates chat across users.
- Future cloud save, inventory, marketplace and multiplayer can use the prepared tables.

## 6. Multiplayer Security Rule

Client-side multiplayer is only a preview. Real rewards must be server-authoritative:

- client requests match action
- server locks credits/skins
- server resolves RNG
- server writes final inventory/credit deltas
- client only displays signed results

TODO: implement settlement through Supabase Edge Functions or Postgres RPC before enabling real skin/credit rewards between players.
