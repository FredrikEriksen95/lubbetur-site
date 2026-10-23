# Lubbetur 2026 – appen

Netlify-siden https://lubbetur.netlify.app publiseres automatisk fra `public/` på `main` (se `netlify.toml`).

## Struktur
- `src/lubbetur.html` – hele appen (samme fil som Claude-artifaktet). Spillhallen er bakt inn mellom `// Spillhallen – oppgavebibliotek` og `\n</script>\n<script>\n`, CSS fra `/* ---------- Spillhallen ---------- */` til `\n</style>`.
- `src/arcade/data.js`, `arcade.js`, `arcade.css` – kilden til Spillhallen.
- `src/site/` – det som bare gjelder Netlify-versjonen: `shim.js` (Firebase i stedet for Claude db/room/user, kodeskjerm), `live.js` (felles opplåsing, vær, valuta), `games.js`/`games.css` (spillkode-modus), `sw.js`, manifest og ikoner.
- `src/vendor/` – Firebase compat SDK 10.14.1 (bakes inn, fordi CDN-er kan være blokkert).
- `tools/bundle.py` – setter `src/arcade/*` inn i `src/lubbetur.html`.
- `tools/build.py` – bygger `public/` fra `src/`.

## Slik gjør du en endring
1. Endre `src/arcade/*` (spill) eller `src/lubbetur.html` (resten av appen) eller `src/site/*`.
2. `python3 tools/bundle.py` (bare hvis `src/arcade` er endret), så `python3 tools/build.py`.
3. Sjekk syntaks: `node -e` med `new Function()` på hvert `<script>` i `public/index.html`.
4. Commit og push til `main`. Netlify publiserer selv i løpet av et minutt.
5. Claude-versjonen: publiser `src/lubbetur.html` til artifaktet https://claude.ai/code/artifact/ccf8adbf-4252-4d05-9945-eb815b092ab5 (les det først, og ikke send `capabilities`).

## Harde regler
- Reisemålet skal ALDRI stå i klartekst noe sted. Det ligger bare i de krypterte blokkene (`SEALED`, `SEALED_DOCS`, `SEALED_ISL`).
- Dokumentsidene (bookingbilder) ligger kryptert per dokument i `SEALED_DOCS` og lastes først når de åpnes. `tools/build.py` flytter dem ut til `public/docs/<nøkkel>.json` (Netlify), så index.html holder seg liten nok til at iPhone ikke kaster appen ut av minnet.
- Netlify Personal: hver publisering koster 15 kreditter (1 000/mnd). Samle endringer og push sjelden.
- `const REVEAL_KEY = null;` i `src/lubbetur.html` skal stå urørt (en planlagt oppgave endrer Claude-versjonen).
- Ikke legg koder (turkode, gjengkode, spillkode, adminpassord) i klartekst i repoet.
- Firestore-data ligger under `g/<sha256('lubbetur:'+kode)>/…`. Reglene i Firebase tillater bare de to kodenes hash, og utløper 2027-01-01.
- Gruppespillene er låst til torsdag 22.10 kl. 11:30 (`GROUP_AT` i `arcade.js`); spillkode-modus er ikke låst.
- Turens toppliste: hvert spill er en gren, beste får N poeng (N = antall i gjengen), en gren teller når minst to har spilt, de `TUR_K` (6) beste grenene teller.
