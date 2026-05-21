export const MINIGAME_DEFINITIONS = [
  {
    id: "roulette",
    name: "Roulette",
    mode: "credits-live",
    stake: "credits",
    reward: "credits",
    serverAuthoritative: false,
    description: "Round realtime condivisi con puntate su rosso, nero e verde."
  },
  {
    id: "market-simulator",
    name: "Market Simulator",
    mode: "economy",
    stake: "credits",
    reward: "credits",
    serverAuthoritative: false,
    description: "Compra e vendi su trend fake stile Steam Market con eventi di prezzo."
  },
  {
    id: "upgrader",
    name: "Upgrader",
    mode: "skin-risk",
    stake: "skin",
    reward: "skin",
    serverAuthoritative: true,
    description: "Metti una skin, scegli moltiplicatore e rischi la perdita per un upgrade."
  },
  {
    id: "coinflip",
    name: "Coinflip",
    mode: "pvp-fast",
    stake: "credits",
    reward: "credits",
    serverAuthoritative: true,
    description: "1v1 veloce testa/croce contro bot o player reale."
  },
  {
    id: "crash",
    name: "Crash",
    mode: "credits",
    stake: "credits",
    reward: "credits",
    serverAuthoritative: true,
    description: "Moltiplicatore live: cashout prima del crash."
  },
  {
    id: "jackpot",
    name: "Jackpot",
    mode: "skin-pot-live",
    stake: "skin",
    reward: "pot",
    serverAuthoritative: false,
    description: "Jackpot skin realtime con ticket proporzionali al numero di skin e tier separati per prestige."
  }
];
