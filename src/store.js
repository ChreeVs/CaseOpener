import { SAVE_KEY } from "./config.js";
import { createDefaultState, normalizeState } from "./gameLogic.js";

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return createDefaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Save load failed", error);
    return createDefaultState();
  }
}

export function saveState(state) {
  try {
    state.lastSeenAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Save failed", error);
    return false;
  }
}

export function exportState(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importState(payload) {
  const decoded = decodeURIComponent(escape(atob(payload.trim())));
  return normalizeState(JSON.parse(decoded));
}

export function resetState() {
  localStorage.removeItem(SAVE_KEY);
  return createDefaultState();
}
