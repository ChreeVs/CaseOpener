export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    const handlers = this.listeners.get(eventName) || new Set();
    handlers.add(handler);
    this.listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off(eventName, handler) {
    this.listeners.get(eventName)?.delete(handler);
  }

  emit(eventName, payload = {}) {
    const envelope = {
      eventName,
      payload,
      at: Date.now()
    };
    (this.listeners.get(eventName) || []).forEach((handler) => handler(envelope));
    (this.listeners.get("*") || []).forEach((handler) => handler(envelope));
    return envelope;
  }
}

export const gameEvents = {
  STATE_READY: "state:ready",
  STATE_CHANGED: "state:changed",
  PLAYER_PATCHED: "player:patched",
  INVENTORY_CHANGED: "inventory:changed",
  ECONOMY_CHANGED: "economy:changed",
  CASE_OPENED: "case:opened",
  SAVE_REQUESTED: "save:requested",
  SAVE_COMPLETED: "save:completed",
  NETWORK_SYNC_REQUESTED: "network:sync-requested",
  NETWORK_SYNC_COMPLETED: "network:sync-completed",
  MULTIPLAYER_MATCH_CREATED: "multiplayer:match-created",
  MULTIPLAYER_MATCH_SETTLED: "multiplayer:match-settled",
  SECURITY_VIOLATION: "security:violation"
};

export const eventBus = new EventBus();
