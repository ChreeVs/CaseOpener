// ─── Minigames Module ───
// Self-contained game UI rendering & loop logic for:
// Roulette (credits), Crash (credits), Coinflip (credits), Upgrader (skins), Jackpot (skins)

import { RARITIES, RARITY_ORDER } from "../../config/rarityConfig.js";
import {
  formatCredits, getSellReturn, getNetWorth,
  playRoulette, playCoinflip, playUpgrader, playJackpot,
  startCrashRound, settleCrashRound, getProfileSkillBonus
} from "../../gameLogic.js";
import {
  escapeHtml, iconMarkup, statTile, rarityClass, compactTime, itemCard
} from "../components/uiElements.js";

// ── Constants ──
const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROUND_DELAY_MS = 4500;
const CRASH_TICK_MS = 60;

// ── State (per-instance, attached to the UI) ──
export function initGamesState(ui) {
  ui.gamesView = "roulette";
  // Roulette
  ui.rouletteAnim = null;
  ui.rouletteTimer = null;
  ui.rouletteCountdown = 0;
  // Crash
  ui.crashAnim = null;
  ui.crashTimer = null;
  ui.crashCountdown = 0;
  // Coinflip
  ui.coinflipAnim = null;
  // Upgrader
  ui.upgraderAnim = null;
  ui.upgraderSelection = new Set(ui.state.minigames?.upgrader?.itemIds || []);
  // Jackpot
  ui.jackpotAnim = null;
}

// ── Game Loops ──
export function startGameLoops(ui) {
  scheduleRoulette(ui);
  scheduleCrash(ui);
}

export function stopGameLoops(ui) {
  clearTimeout(ui.rouletteTimer);
  clearInterval(ui.crashTimer);
  ui.rouletteTimer = null;
  ui.crashTimer = null;
}

function scheduleRoulette(ui) {
  clearTimeout(ui.rouletteTimer);
  ui.rouletteCountdown = ROUND_DELAY_MS;
  const started = Date.now();
  const tick = () => {
    ui.rouletteCountdown = Math.max(0, ROUND_DELAY_MS - (Date.now() - started));
    if (ui.rouletteCountdown <= 0) {
      runRouletteRound(ui);
    } else {
      ui.rouletteTimer = setTimeout(tick, 200);
      if (ui.activeTab === "games" && ui.gamesView === "roulette") {
        const root = ui.root;
        const countdownStr = compactTime(ui.rouletteCountdown);
        const statusNode = root.querySelector('.roulette-game .status-waiting');
        if (statusNode) statusNode.textContent = 'Prossimo round: ' + countdownStr;
      }
    }
  };
  ui.rouletteTimer = setTimeout(tick, 200);
}

function runRouletteRound(ui) {
  // The house always spins. Players only lose/gain if they placed a bet.
  const bet = Number(ui.state.minigames?.roulette?.bet || 0);
  const choice = ui.state.minigames?.roulette?.choice || "red";
  const hasBet = bet > 0 && ui.state.credits >= bet;

  // Generate outcome
  const outcome = Math.floor(Math.random() * 37);
  const type = outcome === 0 ? "green" : ROULETTE_RED.has(outcome) ? "red" : "black";
  const won = hasBet && type === choice;
  const multiplier = choice === "green" ? 14 : 2;
  const payout = won ? bet * multiplier : 0;
  const profit = hasBet ? payout - bet : 0;

  if (hasBet) {
    ui.state.credits -= bet;
    ui.state.credits += payout;
    ui.state.stats.totalSpent = (ui.state.stats.totalSpent || 0) + bet;
    ui.state.stats.totalEarned = (ui.state.stats.totalEarned || 0) + payout;
  }

  // Build reel sequence
  const seq = [...Array.from({length: 42}, () => Math.floor(Math.random() * 37)), outcome];

  ui.rouletteAnim = {
    outcome, type, seq, won, profit, bet: hasBet ? bet : 0,
    payout, choice, spinning: true, startedAt: Date.now(), durationMs: 3200
  };
  ui.renderTopStats();
  if (ui.activeTab === "games" && ui.gamesView === "roulette") ui.renderTab();

  setTimeout(() => {
    if (ui.rouletteAnim) ui.rouletteAnim.spinning = false;
    ui.renderTopStats();
    if (ui.activeTab === "games" && ui.gamesView === "roulette") ui.renderTab();
    setTimeout(() => {
      ui.rouletteAnim = null;
      scheduleRoulette(ui);
    }, 2000);
  }, 3200);
}

function scheduleCrash(ui) {
  clearInterval(ui.crashTimer);
  ui.crashCountdown = ROUND_DELAY_MS;
  const started = Date.now();
  const tick = () => {
    ui.crashCountdown = Math.max(0, ROUND_DELAY_MS - (Date.now() - started));
    if (ui.crashCountdown <= 0) {
      runCrashRound(ui);
    } else {
      ui.crashTimer = setTimeout(tick, 200);
      if (ui.activeTab === "games" && ui.gamesView === "crash") {
        const root = ui.root;
        const anim = ui.crashAnim;
        
        // Update countdown if waiting
        if (!anim) {
          const countdownStr = compactTime(ui.crashCountdown);
          const statusNode = root.querySelector('.crash-game .status-waiting');
          if (statusNode) statusNode.textContent = 'Prossimo round: ' + countdownStr;
        } else {
          // Update graph and text if flying
          const graphLine = root.querySelector('.crash-game .crash-line');
          if (graphLine) {
            const progress = Math.min(1, (Date.now() - anim.startedAt) / anim.flightMs);
            graphLine.style.setProperty('--progress', progress);
          }
          const multText = root.querySelector('.crash-game .crash-multiplier strong');
          if (multText && !anim.cashedOut) {
             multText.textContent = anim.displayPoint.toFixed(2) + 'x';
          }
        }
      }
    }
  };
  ui.crashTimer = setTimeout(tick, 200);
}

function runCrashRound(ui) {
  const crashPoint = 1 + Math.random() * Math.random() * 15;
  const flightMs = 1200 + crashPoint * 400;
  const bet = Number(ui.state.minigames?.crash?.bet || 0);
  const autoCashout = Number(ui.state.minigames?.crash?.autoCashout || 2);
  const hasBet = bet > 0 && ui.state.credits >= bet;

  if (hasBet) ui.state.credits -= bet;

  ui.crashAnim = {
    crashPoint: Number(crashPoint.toFixed(2)),
    flightMs, bet: hasBet ? bet : 0, autoCashout,
    displayPoint: 1.00, cashedOut: false, cashedOutAt: 0,
    spinning: true, startedAt: Date.now(), profit: hasBet ? -bet : 0
  };
  ui.renderTopStats();
  if (ui.activeTab === "games" && ui.gamesView === "crash") ui.renderTab();

  const interval = setInterval(() => {
    if (!ui.crashAnim) { clearInterval(interval); return; }
    const elapsed = Date.now() - ui.crashAnim.startedAt;
    const progress = Math.min(1, elapsed / flightMs);
    const exp = Math.log(crashPoint);
    const point = Math.exp(exp * progress);
    ui.crashAnim.displayPoint = Number(Math.min(crashPoint, point).toFixed(2));

    // Auto cashout
    if (hasBet && !ui.crashAnim.cashedOut && ui.crashAnim.displayPoint >= autoCashout && autoCashout < crashPoint) {
      ui.crashAnim.cashedOut = true;
      ui.crashAnim.cashedOutAt = autoCashout;
      const win = Number((bet * autoCashout).toFixed(2));
      ui.state.credits += win;
      ui.crashAnim.profit = win - bet;
    }

    if (progress >= 1) {
      clearInterval(interval);
      ui.crashAnim.spinning = false;
      ui.crashAnim.displayPoint = crashPoint;
      if (ui.activeTab === "games" && ui.gamesView === "crash") ui.renderTab();
      setTimeout(() => {
        ui.crashAnim = null;
        scheduleCrash(ui);
      }, 2500);
    }
    if (ui.activeTab === "games" && ui.gamesView === "crash") {
        const root = ui.root;
        const anim = ui.crashAnim;
        
        // Update countdown if waiting
        if (!anim) {
          const countdownStr = compactTime(ui.crashCountdown);
          const statusNode = root.querySelector('.crash-game .status-waiting');
          if (statusNode) statusNode.textContent = 'Prossimo round: ' + countdownStr;
        } else {
          // Update graph and text if flying
          const graphLine = root.querySelector('.crash-game .crash-line');
          if (graphLine) {
            const progress = Math.min(1, (Date.now() - anim.startedAt) / anim.flightMs);
            graphLine.style.setProperty('--progress', progress);
          }
          const multText = root.querySelector('.crash-game .crash-multiplier strong');
          if (multText && !anim.cashedOut) {
             multText.textContent = anim.displayPoint.toFixed(2) + 'x';
          }
        }
      }
  }, CRASH_TICK_MS);
}

export function crashCashout(ui) {
  if (!ui.crashAnim || !ui.crashAnim.spinning || ui.crashAnim.cashedOut || !ui.crashAnim.bet) return;
  ui.crashAnim.cashedOut = true;
  ui.crashAnim.cashedOutAt = ui.crashAnim.displayPoint;
  const win = Number((ui.crashAnim.bet * ui.crashAnim.displayPoint).toFixed(2));
  ui.state.credits += win;
  ui.crashAnim.profit = win - ui.crashAnim.bet;
  if (ui.activeTab === "games" && ui.gamesView === "crash") ui.renderTab();
}

// ── Coinflip (manual, instant) ──
export function playCoinflipGame(ui) {
  const bet = Number(ui.state.minigames?.coinflip?.bet || 4);
  const side = ui.state.minigames?.coinflip?.side || "ct";
  if (bet <= 0 || ui.state.credits < bet) return;

  const result = playCoinflip(ui.state, { bet, side });
  if (!result.ok) return;

  ui.coinflipAnim = {
    ...result, spinning: true, startedAt: Date.now(), durationMs: 1600
  };
  ui.renderTopStats();
  if (ui.activeTab === "games" && ui.gamesView === "coinflip") ui.renderTab();
  setTimeout(() => {
    if (ui.coinflipAnim) ui.coinflipAnim.spinning = false;
    if (ui.activeTab === "games" && ui.gamesView === "coinflip") ui.renderTab();
  }, 1600);
}

// ── Upgrader (manual) ──
export function playUpgraderGame(ui) {
  const items = ui.state.inventory.filter(i => ui.upgraderSelection.has(i.id) && !i.locked && i.type !== "rewardCase");
  if (!items.length) return;
  const multiplier = Math.max(1.25, Math.min(12, Number(ui.state.minigames?.upgrader?.targetMultiplier || 2)));
  const result = playUpgrader(ui.state, { itemIds: [...ui.upgraderSelection], targetMultiplier: multiplier });
  if (!result.ok) return;

  ui.upgraderAnim = { ...result, spinning: true, startedAt: Date.now(), durationMs: 2200 };
  ui.renderTopStats();
  if (ui.activeTab === "games" && ui.gamesView === "upgrader") ui.renderTab();
  setTimeout(() => {
    if (ui.upgraderAnim) ui.upgraderAnim.spinning = false;
    if (ui.activeTab === "games" && ui.gamesView === "upgrader") ui.renderTab();
  }, 2200);
}

export function toggleUpgraderItem(ui, id) {
  if (ui.upgraderSelection.has(id)) ui.upgraderSelection.delete(id);
  else ui.upgraderSelection.add(id);
}

// ── Jackpot (manual, skins) ──
export function playJackpotGame(ui) {
  const ids = [...ui.jackpotSelection || []];
  if (!ids.length) return;
  const result = playJackpot(ui.state, { itemIds: ids });
  if (!result.ok) return;

  ui.jackpotAnim = { ...result, spinning: true, startedAt: Date.now() };
  ui.renderTopStats();
  if (ui.activeTab === "games" && ui.gamesView === "jackpot") ui.renderTab();
  
  setTimeout(() => {
    if (ui.jackpotAnim) ui.jackpotAnim.spinning = false;
    if (ui.activeTab === "games" && ui.gamesView === "jackpot") ui.renderTab();
  }, 3840);
}

// ══════════════════════════════════════════
// ── RENDERING ──
// ══════════════════════════════════════════

export function renderGamesTab(ui) {
  const tabs = [
    ["roulette", "circle-dot", "Roulette"],
    ["crash", "trending-up", "Crash"],
    ["coinflip", "coins", "Coin Flip"],
    ["upgrader", "arrow-up-circle", "Upgrade"],
    ["jackpot", "trophy", "Jackpot"]
  ];

  const nav = `
    <div class="game-nav">
      ${tabs.map(([id, icon, label]) => `
        <button class="game-nav-btn ${ui.gamesView === id ? "is-active" : ""}" data-action="games-view" data-view="${id}">
          ${iconMarkup(icon, "game-nav-icon")}
          <span>${label}</span>
        </button>
      `).join("")}
    </div>
  `;

  const views = {
    roulette: () => renderRoulette(ui),
    crash: () => renderCrash(ui),
    coinflip: () => renderCoinflip(ui),
    upgrader: () => renderUpgrader(ui),
    jackpot: () => renderJackpot(ui)
  };

  const content = (views[ui.gamesView] || views.roulette)();
  return `<div class="games-page">${nav}<div class="game-arena">${content}</div></div>`;
}

// ── Roulette ──
function renderRoulette(ui) {
  const anim = ui.rouletteAnim;
  const bet = ui.state.minigames?.roulette?.bet || 0;
  const choice = ui.state.minigames?.roulette?.choice || "red";
  const countdown = ui.rouletteCountdown;
  const seq = anim?.seq || [];
  const resultIdx = seq.length - 1;
  const isSpinning = anim?.spinning;

  return `
    <article class="game-card roulette-game">
      <div class="game-header">
        <h2>${iconMarkup("circle-dot")} Roulette</h2>
        <div class="game-status">
          ${isSpinning ? '<span class="status-live">LIVE</span>' :
            anim ? `<span class="status-result ${anim.won ? 'is-win' : 'is-loss'}">${anim.won ? '+' : ''}${formatCredits(anim.profit)}</span>` :
            `<span class="status-waiting">Prossimo round: ${compactTime(countdown)}</span>`}
        </div>
      </div>

      <div class="roulette-stage ${isSpinning ? 'is-spinning' : ''}" style="--reel-count:${seq.length}; --reel-duration:${anim?.durationMs || 3200}ms;">
        <div class="roulette-pointer"></div>
        <div class="roulette-track">
          <div class="roulette-reel">
            ${seq.map((n, i) => {
              const t = n === 0 ? "green" : ROULETTE_RED.has(n) ? "red" : "black";
              return `<span class="roulette-num ${t} ${i === resultIdx && !isSpinning ? 'is-winner' : ''}">${n}</span>`;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="roulette-bets">
        <input id="rouletteBet" type="number" min="1" value="${escapeHtml(bet)}" placeholder="Puntata" />
        <div class="roulette-colors">
          <button class="roulette-color red ${choice === 'red' ? 'is-active' : ''}" data-action="set-roulette-choice" data-choice="red">Rosso <small>x2</small></button>
          <button class="roulette-color green ${choice === 'green' ? 'is-active' : ''}" data-action="set-roulette-choice" data-choice="green">Verde <small>x14</small></button>
          <button class="roulette-color black ${choice === 'black' ? 'is-active' : ''}" data-action="set-roulette-choice" data-choice="black">Nero <small>x2</small></button>
        </div>
      </div>
    </article>
  `;
}

// ── Crash ──
function renderCrash(ui) {
  const anim = ui.crashAnim;
  const bet = ui.state.minigames?.crash?.bet || 0;
  const autoCashout = ui.state.minigames?.crash?.autoCashout || 2;
  const countdown = ui.crashCountdown;
  const point = anim?.displayPoint || 1.00;
  const crashed = anim && !anim.spinning;
  const flying = anim?.spinning;

  return `
    <article class="game-card crash-game">
      <div class="game-header">
        <h2>${iconMarkup("trending-up")} Crash</h2>
        <div class="game-status">
          ${flying ? '<span class="status-live">LIVE</span>' :
            crashed ? `<span class="status-result is-loss">Crashed @ ${anim.crashPoint}x</span>` :
            `<span class="status-waiting">Prossimo round: ${compactTime(countdown)}</span>`}
        </div>
      </div>

      <div class="crash-stage ${flying ? 'is-flying' : ''} ${crashed ? 'is-crashed' : ''}">
        <div class="crash-multiplier ${anim?.cashedOut ? 'is-cashed' : ''}">
          <strong>${point.toFixed(2)}x</strong>
          ${anim?.cashedOut ? `<small>Cashout @ ${anim.cashedOutAt}x → +${formatCredits(anim.profit)}</small>` : ''}
        </div>
        <div class="crash-graph">
          <div class="crash-line" style="--progress:${anim ? Math.min(1, (Date.now() - anim.startedAt) / anim.flightMs) : 0}"></div>
        </div>
      </div>

      <div class="crash-controls">
        <input id="crashBet" type="number" min="1" value="${escapeHtml(bet)}" placeholder="Puntata" />
        <input id="crashAutoCashout" type="number" min="1.1" step="0.1" value="${escapeHtml(autoCashout)}" placeholder="Auto Cashout" />
        ${flying && anim?.bet && !anim?.cashedOut ?
          `<button class="primary-button danger" data-action="crash-cashout">${iconMarkup("hand")} Cashout ${point.toFixed(2)}x</button>` :
          `<button class="primary-button" disabled>In attesa...</button>`}
      </div>
    </article>
  `;
}

// ── Coinflip ──
function renderCoinflip(ui) {
  const anim = ui.coinflipAnim;
  const bet = ui.state.minigames?.coinflip?.bet || 4;
  const side = ui.state.minigames?.coinflip?.side || "ct";

  return `
    <article class="game-card coinflip-game">
      <div class="game-header">
        <h2>${iconMarkup("coins")} Coin Flip</h2>
      </div>

      <div class="coinflip-stage ${anim?.spinning ? 'is-flipping' : ''} ${anim && !anim.spinning ? (anim.playerWon ? 'is-win' : 'is-loss') : ''}">
        <div class="coinflip-coin">
          <div class="coin-face coin-ct">CT</div>
          <div class="coin-face coin-t">T</div>
        </div>
        <div class="coinflip-result">
          ${anim?.spinning ? 'Flipping...' :
            anim ? `<strong>${String(anim.outcome).toUpperCase()} vince!</strong><span>${anim.playerWon ? '+' : ''}${formatCredits(anim.profit)}</span>` :
            '<strong>Scegli il tuo lato</strong>'}
        </div>
      </div>

      <div class="coinflip-controls">
        <input id="coinflipBet" type="number" min="1" value="${escapeHtml(bet)}" placeholder="Puntata" />
        <div class="coinflip-sides">
          <button class="coin-pick ${side === 'ct' ? 'is-active' : ''}" data-action="set-coinflip-side" data-side="ct">CT</button>
          <button class="coin-pick ${side === 't' ? 'is-active' : ''}" data-action="set-coinflip-side" data-side="t">T</button>
        </div>
        <button class="primary-button" data-action="play-coinflip" ${anim?.spinning ? 'disabled' : ''}>${iconMarkup("rotate-3d")} Lancia</button>
      </div>
    </article>
  `;
}

// ── Upgrader ──
function renderUpgrader(ui) {
  const anim = ui.upgraderAnim;
  const candidates = [...(ui.state.inventory || [])]
    .filter(i => !i.locked && i.type !== "rewardCase")
    .sort((a, b) => b.value - a.value)
    .slice(0, 40);
  const selected = ui.state.inventory.filter(i => ui.upgraderSelection.has(i.id) && !i.locked && i.type !== "rewardCase");
  const total = selected.reduce((s, i) => s + getSellReturn(ui.state, i), 0);
  const multiplier = Math.max(1.25, Math.min(12, Number(ui.state.minigames?.upgrader?.targetMultiplier || 2)));
  const chance = Math.max(6, Math.min(72, (92 / multiplier) * (1 + (getProfileSkillBonus(ui.state).luck || 0) * 1.6)));

  return `
    <article class="game-card upgrader-game">
      <div class="game-header">
        <h2>${iconMarkup("arrow-up-circle")} Upgrade</h2>
        <div class="game-chips">
          ${statTile("Chance", `${chance.toFixed(1)}%`, `x${multiplier.toFixed(2)}`)}
          ${statTile("Input", formatCredits(total, true), `${selected.length} skin`)}
          ${statTile("Target", total ? formatCredits(total * multiplier, true) : "-", "output")}
        </div>
      </div>

      <div class="upgrader-stage ${anim?.spinning ? 'is-upgrading' : ''} ${anim && !anim.spinning ? (anim.won ? 'is-win' : 'is-loss') : ''}">
        <div class="upgrader-orb">
          ${anim?.spinning ? iconMarkup("zap") : anim ? (anim.won ? iconMarkup("check") : iconMarkup("x")) : iconMarkup("sparkles")}
        </div>
        <strong>${anim?.spinning ? 'Upgrading...' : anim ? (anim.won ? 'UPGRADE RIUSCITO' : 'BRUCIATA') : `${chance.toFixed(1)}%`}</strong>
      </div>

      <div class="upgrader-controls">
        <label>Moltiplicatore <input id="upgraderMultiplier" type="range" min="1.25" max="12" step="0.25" value="${multiplier}" /> <strong>x${multiplier.toFixed(2)}</strong></label>
        <button class="primary-button" data-action="play-upgrader" ${selected.length && !anim?.spinning ? '' : 'disabled'}>Upgrade</button>
        <button class="ghost-button" data-action="clear-upgrader" ${selected.length ? '' : 'disabled'}>Pulisci</button>
      </div>

      <div class="upgrader-inventory">
        ${candidates.map(item => `
          <button class="mini-skin-card ${ui.upgraderSelection.has(item.id) ? 'is-selected' : ''}" data-action="toggle-upgrader-item" data-id="${item.id}" style="--rarity:${item.rarityColor}">
            <img src="${item.image || ''}" alt="${escapeHtml(item.name)}" loading="lazy" />
            <span>${formatCredits(item.value, true)}</span>
          </button>
        `).join("") || '<div class="empty-state">Nessuna skin disponibile</div>'}
      </div>
    </article>
  `;
}

// ── Jackpot ──
function renderJackpot(ui) {
  const anim = ui.jackpotAnim;
  if (!ui.jackpotSelection) ui.jackpotSelection = new Set();
  const candidates = [...(ui.state.inventory || [])]
    .filter(i => !i.locked && i.type !== "rewardCase")
    .sort((a, b) => b.value - a.value)
    .slice(0, 40);
  const selected = ui.state.inventory.filter(i => ui.jackpotSelection.has(i.id));
  const pot = selected.reduce((s, i) => s + getSellReturn(ui.state, i), 0);

  return `
    <article class="game-card jackpot-game">
      <div class="game-header">
        <h2>${iconMarkup("trophy")} Jackpot</h2>
        <div class="game-chips">
          ${statTile("Pot", formatCredits(pot, true), `${selected.length} skin`)}
        </div>
      </div>

      <div class="jackpot-stage ${anim?.spinning ? 'is-spinning' : ''} ${anim && !anim.spinning ? (anim.playerWon ? 'is-win' : 'is-loss') : ''}">
        ${anim ? `
          <div class="jackpot-result">
            <strong>${anim.spinning ? 'Spinning...' : anim.playerWon ? 'HAI VINTO!' : 'Perso'}</strong>
            ${!anim.spinning ? `<span>${anim.playerWon ? '+' : ''}${formatCredits(anim.profit)}</span>` : ''}
          </div>
        ` : `
          <div class="jackpot-empty">${iconMarkup("trophy")} <span>Seleziona le skin da mettere in gioco</span></div>
        `}
      </div>

      <div class="jackpot-controls">
        <button class="primary-button" data-action="play-jackpot" ${selected.length && !anim?.spinning ? '' : 'disabled'}>Gioca Jackpot</button>
        <button class="ghost-button" data-action="clear-jackpot" ${selected.length ? '' : 'disabled'}>Pulisci</button>
      </div>

      <div class="jackpot-inventory">
        ${candidates.map(item => `
          <button class="mini-skin-card ${ui.jackpotSelection.has(item.id) ? 'is-selected' : ''}" data-action="toggle-jackpot-item" data-id="${item.id}" style="--rarity:${item.rarityColor}">
            <img src="${item.image || ''}" alt="${escapeHtml(item.name)}" loading="lazy" />
            <span>${formatCredits(item.value, true)}</span>
          </button>
        `).join("") || '<div class="empty-state">Nessuna skin disponibile</div>'}
      </div>
    </article>
  `;
}
