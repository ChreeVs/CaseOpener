import { eventBus, gameEvents } from "../../core/eventBus.js";

export class EconomySystem {
  constructor({ bus = eventBus } = {}) {
    this.bus = bus;
  }

  credit(state, amount, reason = "economy_credit") {
    const value = Math.max(0, Number(amount) || 0);
    state.credits += value;
    state.stats.totalEarned += value;
    this.bus.emit(gameEvents.ECONOMY_CHANGED, { type: "credit", amount: value, reason });
    return value;
  }

  debit(state, amount, reason = "economy_debit") {
    const value = Math.max(0, Number(amount) || 0);
    if (state.credits < value) {
      return { ok: false, reason: "Crediti insufficienti." };
    }
    state.credits -= value;
    state.stats.totalSpent += value;
    this.bus.emit(gameEvents.ECONOMY_CHANGED, { type: "debit", amount: value, reason });
    return { ok: true, amount: value };
  }

  quoteMarketTrend(seed = Date.now()) {
    const phase = Math.sin(seed / 1000 / 60 / 7);
    return {
      multiplier: Number((1 + phase * 0.18).toFixed(3)),
      label: phase > 0.42 ? "Hype Spike" : phase < -0.42 ? "Market Dip" : "Stable"
    };
  }
}

export const economySystem = new EconomySystem();
