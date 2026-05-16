export const MINIGAME_DEFINITIONS = [
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
    stake: "skin-or-credits",
    reward: "opponent-pot",
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
    mode: "pot",
    stake: "skin-or-credits",
    reward: "pot",
    serverAuthoritative: true,
    description: "Ticket proporzionali al valore del piatto, un vincitore prende tutto."
  },
  {
    id: "case-battle",
    name: "Case Battle",
    mode: "case-opening-pvp",
    stake: "cases",
    reward: "all-drops",
    serverAuthoritative: true,
    description: "2-8 giocatori aprono le stesse casse: vince il valore totale più alto."
  }
];
