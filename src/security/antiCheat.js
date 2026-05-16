import { eventBus, gameEvents } from "../core/eventBus.js";

export class AntiCheatGuard {
  constructor({ bus = eventBus } = {}) {
    this.bus = bus;
  }

  validateEconomyDelta({ beforeCredits, afterCredits, reason, maxGain = Infinity }) {
    const delta = Number(afterCredits || 0) - Number(beforeCredits || 0);
    if (delta > maxGain) {
      this.bus.emit(gameEvents.SECURITY_VIOLATION, {
        type: "economy_delta",
        reason,
        delta,
        maxGain
      });
      return false;
    }
    return true;
  }

  validateInventoryItems(items = []) {
    const ids = new Set();
    for (const item of items) {
      if (!item?.id || ids.has(item.id) || !Number.isFinite(Number(item.value))) {
        this.bus.emit(gameEvents.SECURITY_VIOLATION, {
          type: "invalid_inventory_item",
          itemId: item?.id || null
        });
        return false;
      }
      ids.add(item.id);
    }
    return true;
  }

  buildClientAction(action, payload = {}) {
    return {
      action,
      payload,
      clientAt: Date.now(),
      nonce: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
  }

  // TODO Supabase/server: replace client validation with signed server receipts and replay protection.
}

export const antiCheatGuard = new AntiCheatGuard();
