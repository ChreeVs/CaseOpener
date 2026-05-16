export const ACHIEVEMENTS = [
  { id: "first_case", name: "Primo click", description: "Apri la prima cassa.", metric: "casesOpened", target: 1, reward: 2 },
  { id: "case_runper", name: "Case runner", description: "Apri 50 casse.", metric: "casesOpened", target: 50, reward: 8 },
  { id: "grinder", name: "Grinder", description: "Apri 250 casse.", metric: "casesOpened", target: 250, reward: 30 },
  { id: "purple_rain", name: "Purple rain", description: "Trova 25 Restricted.", metric: "rarity.Restricted", target: 25, reward: 18 },
  { id: "pink_flash", name: "Pink flash", description: "Trova 10 Classified.", metric: "rarity.Classified", target: 10, reward: 36 },
  { id: "redline", name: "Redline", description: "Trova 3 Covert.", metric: "rarity.Covert", target: 3, reward: 60 },
  { id: "gold_gold_gold", name: "Gold, gold, gold", description: "Trova un Rare Special Item.", metric: "rarity.Rare Special Item", target: 1, reward: 90 },
  { id: "five_figures", name: "Five figures", description: "Raggiungi 1.000 di net worth.", metric: "netWorth", target: 1000, reward: 35 },
  { id: "six_figures", name: "Six figures", description: "Raggiungi 5.000 di net worth.", metric: "netWorth", target: 5000, reward: 120 },
  { id: "reborn", name: "Reborn", description: "Effettua il primo Prestige.", metric: "prestige", target: 1, reward: 70 },
  { id: "combo_heat", name: "Hot hands", description: "Raggiungi una combo da 20 aperture.", metric: "bestCombo", target: 20, reward: 22 },
  { id: "contractor", name: "Contractor", description: "Completa 3 contratti upgrade.", metric: "contracts", target: 3, reward: 45 },
  { id: "collection_starter", name: "Collection hunter", description: "Completa 3 bonus collezione.", metric: "collections", target: 3, reward: 45 },
  { id: "market_flipper", name: "Market flipper", description: "Rivendi 5 offerte marketplace in profitto.", metric: "marketFlips", target: 5, reward: 50 },
  { id: "event_runner", name: "Event runner", description: "Attiva 4 eventi limitati.", metric: "limitedEvents", target: 4, reward: 35 }
];