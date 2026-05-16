import { eventBus, gameEvents } from "../../core/eventBus.js";
import { MINIGAME_DEFINITIONS } from "./gameDefinitions.js";

export class MinigameSystem {
  constructor({ bus = eventBus, definitions = MINIGAME_DEFINITIONS } = {}) {
    this.bus = bus;
    this.definitions = definitions;
  }

  list() {
    return this.definitions;
  }

  get(id) {
    return this.definitions.find((game) => game.id === id) || null;
  }

  createMatchDraft(gameId, payload = {}) {
    const game = this.get(gameId);
    if (!game) {
      throw new Error(`Unknown minigame: ${gameId}`);
    }
    const draft = {
      id: crypto.randomUUID?.() || `${gameId}-${Date.now()}`,
      gameId,
      status: "draft",
      payload,
      serverAuthoritative: game.serverAuthoritative,
      createdAt: Date.now()
    };
    this.bus.emit(gameEvents.MULTIPLAYER_MATCH_CREATED, draft);
    return draft;
  }

  settleLocalPreview(draft, result) {
    const settled = {
      ...draft,
      status: "settled",
      result,
      settledAt: Date.now()
    };
    this.bus.emit(gameEvents.MULTIPLAYER_MATCH_SETTLED, settled);
    return settled;
  }

  // TODO Supabase realtime: move matchmaking, deposits, RNG and settlement to edge functions.
}

export const minigameSystem = new MinigameSystem();
