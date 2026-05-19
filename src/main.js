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

// ── Single-tab enforcement via BroadcastChannel ──
const tabChannel = new BroadcastChannel("case_opener_tabs");
let isDuplicateTab = false;

tabChannel.onmessage = (event) => {
  if (event.data === "ping") {
    // Another tab is checking – tell it we exist
    tabChannel.postMessage("pong");
  } else if (event.data === "pong" && !isDuplicateTab) {
    // We got a reply → another tab is already running
    isDuplicateTab = true;
    showDuplicateTabError();
  } else if (event.data === "takeover") {
    // A newer tab is forcing us to stop
    isDuplicateTab = true;
    ui?.save();
    ui?.dispose?.();
    ui = null;
    showDuplicateTabError();
  }
};
tabChannel.postMessage("ping");

// ── Cloud auto-save timer ──
const CLOUD_SAVE_INTERVAL_MS = 30000; // 30 seconds
let lastCloudSaveAt = 0;

function autoCloudSave() {
  if (!ui || !ui.isCloudLoggedIn?.() || ui.cloudBusy) {
    return;
  }
  const now = Date.now();
  if (now - lastCloudSaveAt < CLOUD_SAVE_INTERVAL_MS) {
    return;
  }
  lastCloudSaveAt = now;
  ui.saveToCloud({ quiet: true }).catch(() => {
    // silent – cloud save is best-effort
  });
}

// Keyboard navigation state
const keyboardState = {
  lastKeyPress: 0,
  keyRepeatDelay: 200,
  enabled: true
};

function showBootError(error) {
  root.innerHTML = `
    <div class="boot-screen error">
      <img class="boot-logo" src="KarambitQuesto-Colori.png" alt="KarambitQuest" />
      <div class="boot-copy">
        <h1>Errore KarambitQuest</h1>
        <p>${error.message || error}</p>
        <button onclick="location.reload()">Riprova</button>
      </div>
    </div>
  `;
}

function showDuplicateTabError() {
  root.innerHTML = `
    <div class="boot-screen error">
      <img class="boot-logo" src="KarambitQuesto-Colori.png" alt="KarambitQuest" />
      <div class="boot-copy">
        <h1>KarambitQuest gia' aperto</h1>
        <p>Il gioco e' gia' attivo in un'altra scheda o finestra.<br>Chiudi le altre istanze oppure usa il pulsante qui sotto per forzare l'apertura qui.</p>
        <button onclick="location.reload()">Riprova</button>
        <button onclick="document.querySelector('#app').__forceTakeover?.()">Apri qui</button>
      </div>
    </div>
  `;
  root.__forceTakeover = () => {
    isDuplicateTab = false;
    tabChannel.postMessage("takeover");
    location.reload();
  };
  /* Legacy duplicate-tab markup kept unreachable by previous edits:
  root.innerHTML = `
    <div class="boot-screen error">
      <div class="boot-mark" style="font-size:2.5rem">⚠</div>
      <div>
        <h1>Gioco già aperto</h1>
        <p>Il gioco è già attivo in un'altra scheda o finestra.<br>Chiudi le altre istanze oppure usa il pulsante qui sotto per forzare l'apertura qui.</p>
        <button onclick="location.reload()">Riprova</button>
        <button onclick="document.querySelector('#app').__forceTakeover?.()">Apri qui</button>
      </div>
    </div>
  `;
  // Attach takeover function
  root.__forceTakeover = () => {
    isDuplicateTab = false;
    tabChannel.postMessage("takeover");
    location.reload();
  };
}
*/
}
async function start({ forceRefresh = false } = {}) {
  // Give time for BroadcastChannel ping-pong round-trip
  await new Promise(resolve => setTimeout(resolve, 150));
  if (isDuplicateTab) {
    return;
  }

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
  tabChannel.close();
});

setInterval(() => {
  if (!ui || isDuplicateTab) {
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
  if (isDuplicateTab) {
    return;
  }
  ui?.save();
  autoCloudSave();
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
