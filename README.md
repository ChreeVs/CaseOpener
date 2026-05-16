# Case Opener Incremental

Gioco clicker/incrementale web ispirato ai case opening CS2. Usa skin e immagini reali dalla ByMykel CSGO API:

`https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json`

Le casse reali arrivano da:

`https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json`

## Avvio

```bash
node server.cjs
```

Poi apri `http://localhost:5173`.

Non servono dipendenze npm. Il server statico è incluso in `server.cjs`.

## Struttura

- `src/config.js`: bilanciamento, rarità, upgrade, achievement, economia.
- `src/api.js`: fetch ByMykel API, cache IndexedDB/localStorage, normalizzazione skin, costruzione casse reali e refresh prezzi Steam.
- `src/gameLogic.js`: drop, float/usura, valori, prestige, idle, upgrade, vendite, contratti, marketplace e minigiochi.
- `src/store.js`: save/load/export/import/reset via localStorage.
- `src/ui.js`: rendering interfaccia, reel animation, inventario paginato, shop, stats.
- `src/main.js`: bootstrap, timer, autosave, refresh API.
- `styles.css`: tema dark, responsive layout, glow rarità e animazioni.

## Note di espansione

Le percentuali base sono in `DROP_PROFILES`. In condizioni normali il gioco genera tutte le casse con `type: "Case"` da `crates.json` e usa le skin realmente associate in `skins.json`. `CASE_BLUEPRINTS` resta come fallback se la cache/API delle casse non è disponibile. I prezzi vengono aggiornati tramite il proxy locale `/api/steam-prices`, che legge `lowest_price`/`median_price` dal Market Steam e converte 1 euro in 100 crediti.

L'inventario renderizza solo una pagina alla volta e le immagini usano `loading="lazy"` per restare fluido anche con inventari grandi.

## Sistemi avanzati

- `ECONOMY_CONFIG`: commissioni vendita, marketplace, auto-sell e reward collezioni.
- `PRESTIGE_TREE`: nodi permanenti spendibili con shard Prestige.
- `LIMITED_EVENTS`: eventi temporanei come Knife Fever, Low Float Hunt e Double XP.
- `MARKET_TRENDS`: trend del marketplace simulato con volatilità e edge.
- Minigiochi: roulette e pachinko con puntate configurabili, storico, payout e soft cap giornaliero in `ECONOMY_CONFIG.minigameDailySoftCap`.
- Case mastery: ogni cassa sale di livello con le aperture. Ogni livello aggiunge fortuna solo su quella cassa; curva, bonus per livello e cap sono in `ECONOMY_CONFIG`.
- Sblocco casse: le Weapon Case reali vengono distribuite dal Prestige 0 al Prestige 8 in base a recenza e valore fallback, così le casse economiche restano early game e quelle storiche/costose diventano obiettivi di progressione.
- Cheat menu: tab locale di debug per aggiungere crediti, Prestige, shard, max upgrade, mastery cassa e reset cooldown.

Le collezioni usano progressi lifetime: una skin scoperta resta valida anche se viene venduta. Favorite e lock proteggono gli item da vendite bulk e contratti.

## Upgrade/UI aggiunti

- Case scanner integrato nella cassa selezionata: EV stimato, ROI, drop table e preview del best tier.
- Modal dettaglio skin cliccando immagine/nome: immagine grande, float bar, valore, vendita, lock e favorite.
- Shop a rami: Apertura, Fortuna, Automazione, Economia, Collezioni e Contratti.
- Auto-sell avanzato: rarità massima, min/max valore, float minimo, duplicati e protezione Special Item.
- Nuovi upgrade funzionali: Market Analyst, Drop Insurance, Collection Hunter e Trade-up Specialist.
