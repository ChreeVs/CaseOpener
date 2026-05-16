import { eventBus, gameEvents } from "../../core/eventBus.js";

export function registerMultiplayerHooks({ bus = eventBus, networkClient } = {}) {
  const unsubscribers = [
    bus.on(gameEvents.CASE_OPENED, ({ payload }) => {
      // TODO Supabase leaderboard: aggregate case opens, best drops and session stats.
      networkClient?.syncPlayer?.({ reason: "case_opened", payload }).catch(() => {});
    }),
    bus.on(gameEvents.MULTIPLAYER_MATCH_CREATED, ({ payload }) => {
      // TODO Supabase realtime: broadcast lobby creation to channel game:{gameId}.
      networkClient?.createMatch?.(payload).catch(() => {});
    }),
    bus.on(gameEvents.SECURITY_VIOLATION, ({ payload }) => {
      console.warn("Security violation", payload);
      // TODO server: send signed violation report with session id and action nonce.
    })
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
