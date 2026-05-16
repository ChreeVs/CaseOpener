import { eventBus, gameEvents } from "../core/eventBus.js";

export class SaveRepository {
  constructor({ storage = localStorage, key, bus = eventBus } = {}) {
    this.storage = storage;
    this.key = key;
    this.bus = bus;
  }

  load(defaultFactory, normalizer) {
    try {
      const raw = this.storage.getItem(this.key);
      const state = raw ? JSON.parse(raw) : defaultFactory();
      return normalizer ? normalizer(state) : state;
    } catch (error) {
      console.warn("SaveRepository load failed", error);
      return defaultFactory();
    }
  }

  save(state, { reason = "autosave" } = {}) {
    this.bus.emit(gameEvents.SAVE_REQUESTED, { reason });
    state.lastSeenAt = Date.now();
    this.storage.setItem(this.key, JSON.stringify(state));
    this.bus.emit(gameEvents.SAVE_COMPLETED, { reason, at: state.lastSeenAt });
    return true;
  }

  clear() {
    this.storage.removeItem(this.key);
  }
}
