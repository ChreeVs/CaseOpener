# Case Opener Architecture

## Target Structure

```text
src/
  core/
    eventBus.js
    playerData.js
  systems/
    economy/
      economySystem.js
    games/
      gameDefinitions.js
      minigameSystem.js
    multiplayer/
      multiplayerHooks.js
  network/
    networkClient.js
  persistence/
    saveRepository.js
  security/
    antiCheat.js
  ui/
    systems/
      uiEvents.js
  config/
  api.js
  gameLogic.js
  ui.js
```

## Pattern

The current app keeps the working UI in `src/ui.js` and the existing simulation in `src/gameLogic.js`. New code should move toward this flow:

```text
UI command -> system action -> playerData transaction -> eventBus event -> persistence/network sync
```

DOM handlers should not mutate nested state directly. They should call a system, and systems should emit events.

## Player Data

`PlayerDataStore` is the central state owner for future cloud sync. It supports hydration, path patches and transactions.

Supabase TODO:
- store `profiles`
- store `player_state`
- store inventory rows server-side
- sync via revision number and conflict policy
- enable RLS per authenticated user

## Networking

`NetworkClient` is provider-agnostic. Local mode is safe for the current demo. Supabase mode should add:

- auth session
- signed match actions
- realtime channels
- edge functions for RNG settlement
- server receipts for inventory mutations

## Multiplayer Friendly Anti-Cheat

Client-side checks are only UX checks. Real protection requires server authority:

- server creates match/lobby ids
- server locks deposited skins
- server resolves RNG
- server writes final inventory deltas
- client receives signed result receipts
- replay protection via nonce/action id

## Minigame Roadmap

Implemented as definitions first:

- Market Simulator: local economy first, cloud market later
- Upgrader: skin input, probability, loss on fail
- Coinflip: fast 1v1 bot/player
- Crash: credits in, credits out
- Jackpot: skin/credit pot, winner takes pot

Before real multiplayer, each game must expose:

- `createMatchDraft`
- `validateStake`
- `lockStake`
- `settle`
- `applyRewards`

The server version should own `lockStake`, `settle` and `applyRewards`.
