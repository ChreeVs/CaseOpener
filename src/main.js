import { ACTIVE_TICK_MS, AUTO_SAVE_MS } from "./config/gameConfig.js";
import { buildSkinData, loadSkins, refreshCasePrices } from "./api.js";
import { eventBus, gameEvents } from "./core/eventBus.js";
import { createPlayerDataStore } from "./core/playerData.js";
import { applyPassiveIncome, claimOfflineIncome, formatCredits, syncAchievements } from "./gameLogic.js";
import { networkClient } from "./network/networkClient.js";
import { registerMultiplayerHooks } from "./systems/multiplayer/multiplayerHooks.js";
import { loadState, saveState } from "./store.js";
import { CaseOpenerUI } from "./ui.js";

const root = document.querySelector("#app");
let ui = null;
let lastTickAt = Date.now();
const playerData = createPlayerDataStore({ bus: eventBus });
const disposeMultiplayerHooks = registerMultiplayerHooks({ bus: eventBus, networkClient });

// Keyboard navigation state
const keyboardState = {
  lastKeyPress: 0,
  keyRepeatDelay: 200,
  enabled: true
};

function showBootError(error) {
  root.innerHTML = `
    <div class="boot-screen error">
      <div class="boot-mark">!</div>
      <div>
        <h1>Errore caricamento</h1>
        <p>${error.message || error}</p>
        <button onclick="location.reload()">Riprova</button>
      </div>
    </div>
  `;
}

async function start({ forceRefresh = false } = {}) {
  try {
    root.classList.add("is-loading");
    
    // Global timeout: max 15 seconds for bootstrap
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Bootstrap timeout: API took too long')), 15000)
    );
    
    const loadPromise = (async () => {
      const metadata = await loadSkins({ forceRefresh });
      const skinData = buildSkinData(metadata.skins, metadata.crates);
      const state = loadState();
      playerData.hydrate(state, { source: "localStorage" });
      const offline = claimOfflineIncome(state);
      const achievements = syncAchievements(state);

      ui?.dispose?.();
      ui = new CaseOpenerUI(root, state, skinData, metadata);
      ui.mount();
      eventBus.emit(gameEvents.STATE_READY, {
        source: "bootstrap",
        skinCount: skinData.skins.length,
        caseCount: skinData.cases.length
      });

      refreshCasePrices(skinData.cases).then((updated) => {
        if (!updated || !ui) {
          return;
        }
        ui.toast(`Prezzi Steam aggiornati per ${updated} casse.`);
        ui.renderAll();
        ui.save();
      }).catch((error) => {
        console.warn("[Main] Failed to refresh case prices:", error);
      });

      if (metadata.warning) {
        ui.toast(metadata.warning);
      }
      if (offline > 0) {
        ui.toast(`Idle offline: +${formatCredits(offline)}.`);
      }
      achievements.forEach((achievement) => ui.toast(`Achievement: ${achievement.name}`));

      saveState(state);
      return true;
    })();
    
    await Promise.race([loadPromise, timeoutPromise]);
    root.classList.remove("is-loading");
  } catch (error) {
    console.error(error);
    showBootError(error);
  }
}

window.addEventListener("force-api-refresh", async () => {
  if (ui) {
    ui.toast("Aggiornamento API in corso...");
    ui.save();
  }
  await start({ forceRefresh: true });
});

window.addEventListener("beforeunload", () => {
  ui?.save();
  ui?.dispose?.();
  disposeMultiplayerHooks?.();
});

setInterval(() => {
  if (!ui) {
    return;
  }
  if (!ui.isCloudLoggedIn?.()) {
    lastTickAt = Date.now();
    ui.tick();
    return;
  }
  const now = Date.now();
  applyPassiveIncome(ui.state, now - lastTickAt);
  lastTickAt = now;
  ui.autoTick();
  ui.tick();
  ui.setSaved(false);
}, ACTIVE_TICK_MS);

setInterval(() => {
  ui?.save();
}, AUTO_SAVE_MS);

function switchTab(tab) {
  ui?.handleAction?.("tab", { tab });
}

function switchPrimaryTab(delta) {
  const tabs = ["cases", "inventory", "shop", "market", "stats", "achievements", "prestige", "games", "community"];
  const current = tabs.includes(ui?.activeTab) ? ui.activeTab : tabs[0];
  const nextIndex = (tabs.indexOf(current) + delta + tabs.length) % tabs.length;
  switchTab(tabs[nextIndex]);
}

function closeTopOverlay() {
  ui?.closeOpenResultSummary?.();
  ui?.closeInspector?.();
  const rareReveal = document.querySelector("#rareReveal");
  if (rareReveal) {
    rareReveal.hidden = true;
  }
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (!ui || !keyboardState.enabled) return;
  if (isTypingTarget(e.target)) return;

  // Prevent rapid key repeats
  const now = Date.now();
  if (now - keyboardState.lastKeyPress < keyboardState.keyRepeatDelay) return;
  keyboardState.lastKeyPress = now;

  // Handle key presses based on current tab/focus
  switch (e.key) {
    case " ":
    case "Enter":
      // Space/Enter to open case if in cases tab
      if (ui.activeTab === "cases") {
        e.preventDefault(); // Prevent page scroll
        ui.openSelectedCase(false);
      }
      break;

    case "ArrowRight":
      // Right arrow to navigate tabs forward
      if (!e.ctrlKey && !e.metaKey && !e.altKey) { // Only if not modified
        e.preventDefault();
        switchPrimaryTab(1);
      }
      break;

    case "ArrowLeft":
      // Left arrow to navigate tabs backward
      if (!e.ctrlKey && !e.metaKey && !e.altKey) { // Only if not modified
        e.preventDefault();
        switchPrimaryTab(-1);
      }
      break;

    case "Escape":
      // Escape to close dialogs/popups
      e.preventDefault();
      closeTopOverlay();
      break;

    case "c":
    case "C":
      // 'c' key to go to collections
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        switchTab("collections");
      }
      break;

    case "s":
    case "S":
      // 's' key to go to shop
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        switchTab("shop");
      }
      break;

    case "i":
    case "I":
      // 'i' key to go to inventory
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        switchTab("inventory");
      }
      break;
  }
});

// Also handle keyup to reset state if needed
document.addEventListener("keyup", () => {
  // Reset any key state if needed
});

start();
