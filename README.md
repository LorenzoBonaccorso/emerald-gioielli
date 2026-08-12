# Emerald Gioielli — Compro Oro a Mascali

Landing page ufficiale di Emerald Gioielli dedicata alla quotazione di oro e argento e alla valutazione dei preziosi presso il negozio di Mascali.

Sito pubblico: https://comprooro.emeraldgioielli.com/

## Funzionalità

- quotazione indicativa di oro 18K, oro 24K e argento 800;
- aggiornamento automatico dei valori di mercato;
- calcolatore grammi/euro;
- informazioni sul processo di valutazione;
- contatti, WhatsApp e indicazioni stradali;
- SEO tecnico con canonical, sitemap, robots.txt e dati strutturati;
- analytics caricato soltanto dopo il consenso dell’utente;
- Google Maps caricato soltanto dopo una richiesta esplicita;
- test automatici per formule commerciali e struttura SEO.

## Struttura

- `index.html`: contenuti, metadati SEO e dati strutturati;
- `style.css`: interfaccia responsive;
- `script.js`: quotazioni, calcolatore, navigazione e consenso analytics;
- `pricing.mjs`: formule commerciali pure e testabili;
- `scripts/update-market-prices.mjs`: generazione del cambio USD/EUR;
- `tests/`: test Node.js senza dipendenze esterne;
- `data/market-prices.json`: dato generato durante il deployment;
- `.github/workflows/update-market-prices.yml`: build e pubblicazione GitHub Pages;
- `sitemap.xml` e `robots.txt`: scoperta e scansione da parte dei motori di ricerca.

## Sviluppo locale

Il sito è statico. Avvialo tramite un server HTTP locale, per esempio:

```bash
python -m http.server 8080
```

Poi visita `http://localhost:8080`. L’apertura diretta di `index.html` non è consigliata perché alcune richieste dati usano percorsi relativi.

Esegui i controlli automatici con Node.js 24:

```bash
npm test
npm run check
```

## Quotazioni e Secret

Il workflow usa il Secret GitHub `TICKBASE_API_KEY` per aggiornare il cambio USD/EUR senza esporre la chiave nel browser. Le quotazioni dei metalli vengono recuperate da Gold-API; se una fonte non è disponibile, il client prova le fonti di riserva e infine la cache locale recente.

Il risultato del calcolatore è indicativo e non costituisce un’offerta vincolante. La proposta definitiva richiede la verifica del materiale in negozio.

## Pubblicazione

Il branch `main` viene pubblicato su GitHub Pages:

- a ogni push su `main`;
- ogni ora per rigenerare i dati;
- manualmente tramite `workflow_dispatch`.

Prima del deployment il workflow esegue test e controlli sintattici. Se l’aggiornamento del cambio fallisce, il job fallisce e GitHub Pages conserva l’ultimo deployment valido. Le GitHub Actions sono bloccate a commit SHA verificati.

Il pacchetto pubblico include HTML, CSS, JavaScript, il modulo di pricing, immagini, dati, CNAME, sitemap e robots.txt.

## Indicizzazione

Dopo una pubblicazione significativa:

1. verificare `https://comprooro.emeraldgioielli.com/robots.txt`;
2. verificare `https://comprooro.emeraldgioielli.com/sitemap.xml`;
3. inviare la sitemap nella proprietà corretta di Google Search Console;
4. usare “Test URL pubblicato” e richiedere l’indicizzazione della home.

L’indicizzazione non è garantita dai metadati: sono importanti anche contenuti utili, collegamenti dal sito principale e segnali locali coerenti.

## Dati aziendali

Emerald Gioielli · Via Siculo Orientale, 276 — 95016 Mascali (CT)

Telefono: +39 328 376 8677

P. IVA: 03231030879
