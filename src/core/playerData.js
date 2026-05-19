import { eventBus, gameEvents } from "./eventBus.js";

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function getPathValue(target, path) {
  if (!target || !path) return undefined;
  return path.split(".").reduce((value, key) => value?.[key], target);
}

function setPathValue(target, path, value) {
  const keys = path.split(".");
  const finalKey = keys.pop();
  const parent = keys.reduce((node, key) => {
    node[key] ||= {};
    return node[key];
  }, target);
  parent[finalKey] = value;
}

export class PlayerDataStore {
  constructor({ bus = eventBus, initialState = null } = {}) {
    this.bus = bus;
    this.state = initialState;
    this.revision = 0;
    this.authoritativeMode = false;
  }

  hydrate(state, { source = "local" } = {}) {
    this.state = state;
    this.revision += 1;
    this.bus.emit(gameEvents.STATE_READY, {
      source,
      revision: this.revision,
      state: this.state
    });
    return this.state;
  }

  getSnapshot() {
    return clone(this.state);
  }

  get(path, fallback = undefined) {
    const value = getPathValue(this.state, path);
    return value === undefined ? fallback : value;
  }

  patch(path, value, meta = {}) {
    if (!this.state) {
      throw new Error("PlayerDataStore is not hydrated.");
    }
    setPathValue(this.state, path, value);
    this.revision += 1;
    this.bus.emit(gameEvents.PLAYER_PATCHED, {
      path,
      value,
      meta,
      revision: this.revision
    });
    this.bus.emit(gameEvents.STATE_CHANGED, {
      reason: meta.reason || "patch",
      revision: this.revision
    });
    return this.state;
  }

  transaction(reason, mutator) {
    if (!this.state) {
      throw new Error("PlayerDataStore is not hydrated.");
    }
    const beforeRevision = this.revision;
    const result = mutator(this.state);
    this.revision += 1;
    this.bus.emit(gameEvents.STATE_CHANGED, {
      reason,
      revision: this.revision,
      previousRevision: beforeRevision
    });
    return result;
  }

  setAuthoritativeMode(enabled) {
    this.authoritativeMode = Boolean(enabled);
  }
}

export function createPlayerDataStore(options = {}) {
  return new PlayerDataStore(options);
}
