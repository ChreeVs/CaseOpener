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

## 4. Enable Anonymous Auth

In Supabase:

```text
Authentication -> Providers -> Anonymous Sign-Ins
```

Enable anonymous sign-ins. This gives every browser a lightweight Supabase user without email/password and lets the game write only that user's `player_states` row through RLS.

If this is disabled, the game still works locally but the `Cloud save -> Accedi anon` button will fail.

## 5. Enable Account Login

### Username + Password

The game supports username/password by using Supabase email/password auth with a technical email:

```text
username@caseopener.local
```

In Supabase:

```text
Authentication -> Providers -> Email
```

Enable Email provider and disable email confirmation for this prototype. If email confirmation stays enabled, users created with `username@caseopener.local` cannot confirm the account.

### Discord

In Supabase:

```text
Authentication -> Providers -> Discord
```

Enable Discord and add the Discord OAuth credentials from a Discord Developer Portal application.

In the Discord Developer Portal OAuth2 settings, add the Supabase callback URL:

```text
https://bupggkmnepkupxitnelg.supabase.co/auth/v1/callback
```

Add the site URL and redirect URL in Supabase Auth settings. For GitHub Pages:

```text
Site URL: https://chreevs.github.io/CaseOpener/
Redirect URL: https://chreevs.github.io/CaseOpener/
```

For local tests, add:

```text
http://localhost:5173/
```

When Discord login succeeds, the game reads the Discord display name from Supabase user metadata and applies it to the player profile.

## 6. Configure Frontend

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

## 7. Current Free Online Features

After this setup:

- GitHub Pages hosts the game.
- Supabase stores chat messages.
- Supabase Realtime updates chat across users.
- Anonymous cloud accounts can save/load `player_states`.
- Discord and username/password accounts can save/load `player_states`.
- Future server inventory, marketplace and multiplayer can use the prepared tables.

## 8. Multiplayer Security Rule

Client-side multiplayer is only a preview. Real rewards must be server-authoritative:

- client requests match action
- server locks credits/skins
- server resolves RNG
- server writes final inventory/credit deltas
- client only displays signed results

TODO: implement settlement through Supabase Edge Functions or Postgres RPC before enabling real skin/credit rewards between players.
