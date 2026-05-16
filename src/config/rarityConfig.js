export const RARITY_ORDER = [
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec",
  "Restricted",
  "Classified",
  "Covert",
  "Rare Special Item"
];

export const RARITIES = {
  "Consumer Grade": {
    key: "consumer",
    short: "Consumer",
    api: ["Consumer Grade"],
    color: "#b0c3d9",
    baseValue: 0.2,
    tier: 0
  },
  "Industrial Grade": {
    key: "industrial",
    short: "Industrial",
    api: ["Industrial Grade"],
    color: "#5e98d9",
    baseValue: 0.65,
    tier: 1
  },
  "Mil-Spec": {
    key: "milspec",
    short: "Mil-Spec",
    api: ["Mil-Spec Grade", "Mil-Spec"],
    color: "#4b69ff",
    baseValue: 2.1,
    tier: 2
  },
  Restricted: {
    key: "restricted",
    short: "Restricted",
    api: ["Restricted"],
    color: "#8847ff",
    baseValue: 6.1,
    tier: 3
  },
  Classified: {
    key: "classified",
    short: "Classified",
    api: ["Classified"],
    color: "#d32ce6",
    baseValue: 18,
    tier: 4
  },
  Covert: {
    key: "covert",
    short: "Covert",
    api: ["Covert", "Contraband"],
    color: "#eb4b4b",
    baseValue: 60,
    tier: 5
  },
  "Rare Special Item": {
    key: "rare",
    short: "Special",
    api: ["Extraordinary", "Rare Special Item"],
    color: "#ffd166",
    baseValue: 310,
    tier: 6
  }
};

export const API_RARITY_TO_GAME = Object.entries(RARITIES).reduce((map, [gameRarity, meta]) => {
  meta.api.forEach((apiName) => {
    map[apiName] = gameRarity;
  });
  return map;
}, {});