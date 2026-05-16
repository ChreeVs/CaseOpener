import { eventBus, gameEvents } from "../core/eventBus.js";

export class NetworkClient {
  constructor({ bus = eventBus, baseUrl = "", provider = "local" } = {}) {
    this.bus = bus;
    this.baseUrl = baseUrl;
    this.provider = provider;
    this.session = null;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(this.session?.accessToken ? { Authorization: `Bearer ${this.session.accessToken}` } : {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Network request failed: ${response.status}`);
    }
    return payload;
  }

  async syncPlayer(snapshot) {
    this.bus.emit(gameEvents.NETWORK_SYNC_REQUESTED, { provider: this.provider });
    // TODO Supabase: replace with upsert into profiles/player_state using row-level security.
    const result = this.provider === "local"
      ? { ok: true, mode: "local", snapshotRevision: snapshot?.revision || 0 }
      : await this.request("/api/player/sync", {
        method: "POST",
        body: JSON.stringify(snapshot)
      });
    this.bus.emit(gameEvents.NETWORK_SYNC_COMPLETED, result);
    return result;
  }

  async createMatch(matchPayload) {
    // TODO Supabase realtime: insert lobby row, broadcast lobby update, lock deposits server-side.
    return this.request("/api/matches", {
      method: "POST",
      body: JSON.stringify(matchPayload)
    });
  }

  async settleMatch(matchId, clientProof) {
    // TODO server-authoritative: server must resolve RNG, verify stakes, then return signed result.
    return this.request(`/api/matches/${encodeURIComponent(matchId)}/settle`, {
      method: "POST",
      body: JSON.stringify({ clientProof })
    });
  }
}

export const networkClient = new NetworkClient();
