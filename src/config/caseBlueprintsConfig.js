const PRESTIGE_RISK_CASES = [
  { prestige: 5, price: 2200, accent: "#ff7a90", image: "Operation Broken Fang Case" },
  { prestige: 6, price: 4400, accent: "#ff8f5e", image: "Prisma Case" },
  { prestige: 7, price: 8500, accent: "#f7c948", image: "Revolution Case" },
  { prestige: 8, price: 14500, accent: "#72d572", image: "Recoil Case" },
  { prestige: 9, price: 25500, accent: "#46d8c8", image: "Fracture Case" },
  { prestige: 10, price: 42000, accent: "#64d7e3", image: "Dreams & Nightmares Case" },
  { prestige: 11, price: 68000, accent: "#7aa2ff", image: "Snakebite Case" },
  { prestige: 12, price: 110000, accent: "#a77cff", image: "Clutch Case" },
  { prestige: 13, price: 170000, accent: "#d56cff", image: "Glove Case" },
  { prestige: 14, price: 250000, accent: "#ff5ec4", image: "CS:GO Weapon Case 2" },
  { prestige: 15, price: 365000, accent: "#ff5e73", image: "Operation Hydra Case" }
].map(({ prestige, price, accent, image }) => ({
  id: `prestige-${prestige}-risk`,
  name: `Prestige ${prestige} Risk Case`,
  description: "Cassa ad EV alto: puoi guadagnare, ma solo qui puo' uscire una skin malus permanente.",
  synthetic: "prestige-risk",
  preferredImage: image,
  price,
  profile: "risk",
  unlockPrestige: prestige,
  accent,
  valueScale: 1,
  riskCase: true,
  malusEnabled: true,
  alwaysAvailable: true
}));

export const CASE_BLUEPRINTS = [
  {
    id: "recruit-supply",
    name: "Recruit Supply",
    description: "Cassa gratuita anti-stallo. Solo manuale, rendita piccola ma costante.",
    synthetic: "free",
    price: 0,
    profile: "free",
    unlockPrestige: 0,
    accent: "#64d7e3",
    manualOnly: true,
    valueScale: 0.34,
    alwaysAvailable: true
  },
  {
    id: "starter-drop",
    name: "Starter Drop Crate",
    description: "Low-stakes crate built from CS2 collection skins. Great for early combo streaks.",
    synthetic: "starter",
    price: 8,
    profile: "starter",
    unlockPrestige: 0,
    accent: "#5e98d9"
  },
  {
    id: "workshop-cache",
    name: "Workshop Cache",
    description: "A mixed crate with a deeper low-to-mid tier pool and occasional heat.",
    synthetic: "budget",
    price: 24,
    profile: "budget",
    unlockPrestige: 0,
    accent: "#8fd14f"
  },
  {
    id: "dreams-nightmares",
    match: "Dreams & Nightmares Case",
    price: 52,
    profile: "standard",
    unlockPrestige: 0,
    accent: "#d32ce6"
  },
  {
    id: "recoil",
    match: "Recoil Case",
    price: 58,
    profile: "standard",
    unlockPrestige: 0,
    accent: "#f2a541"
  },
  {
    id: "snakebite",
    match: "Snakebite Case",
    price: 65,
    profile: "standard",
    unlockPrestige: 0,
    accent: "#9fd356"
  },
  {
    id: "fracture",
    match: "Fracture Case",
    price: 76,
    profile: "standard",
    unlockPrestige: 1,
    accent: "#e86a92"
  },
  {
    id: "clutch",
    match: "Clutch Case",
    price: 95,
    profile: "premium",
    unlockPrestige: 1,
    accent: "#ffb703"
  },
  {
    id: "broken-fang",
    match: "Operation Broken Fang Case",
    price: 130,
    profile: "premium",
    unlockPrestige: 2,
    accent: "#fb5607"
  },
  {
    id: "glove",
    match: "Glove Case",
    price: 165,
    profile: "premium",
    unlockPrestige: 3,
    accent: "#06d6a0"
  },
  {
    id: "jackpot-special",
    name: "Jackpot Special Case",
    description: "Prestige-only crate weighted toward elite skins, knives and gloves.",
    synthetic: "jackpot",
    price: 420,
    profile: "jackpot",
    unlockPrestige: 4,
    accent: "#ffd166"
  },
  {
    id: "prestige-14-relic",
    name: "Prestige 14 Relic Case",
    description: "Late prestige crate with a high-tier pool and controlled P14 economy.",
    synthetic: "prestige14",
    preferredImage: "CS:GO Weapon Case 2",
    price: 128000,
    profile: "collector",
    unlockPrestige: 14,
    accent: "#a77cff",
    valueScale: 2650,
    alwaysAvailable: true
  },
  {
    id: "prestige-14-apex",
    name: "Prestige 14 Apex Case",
    description: "Top-end P14 crate tuned below final prestige case pricing.",
    synthetic: "prestige14",
    preferredImage: "CS:GO Weapon Case 2",
    price: 188000,
    profile: "jackpot",
    unlockPrestige: 14,
    accent: "#64d7e3",
    valueScale: 2850,
    alwaysAvailable: true
  },
  ...PRESTIGE_RISK_CASES
];
