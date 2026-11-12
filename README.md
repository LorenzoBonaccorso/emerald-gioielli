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
- `quote-snapshot.mjs`: validazione e scadenza dei dati iniziali e della cache;
- `scripts/update-market-prices.mjs`: generazione di cambio USD/EUR e quotazioni dei metalli;
- `scripts/build-site.mjs`: quotazioni già presenti nell’HTML e bundle browser con esbuild;
- `tests/`: test Node.js di prezzi, pubblicazione e funzionamento con API offline;
- `data/market-prices.json`: dato generato durante il deployment;
- `.github/workflows/update-market-prices.yml`: build e pubblicazione GitHub Pages;
- `sitemap.xml` e `robots.txt`: scoperta e scansione da parte dei motori di ricerca.

## Sviluppo locale

Con Node.js 24, installa le dipendenze e genera il sito come in produzione:

```bash
npm ci
npm run market:update
npm run build
python -m http.server 8080 --directory dist
```

Poi visita `http://localhost:8080`. L’apertura diretta di `index.html` non è consigliata perché alcune richieste dati usano percorsi relativi.

Esegui i controlli automatici con Node.js 24:

```bash
npm test
npm run check
```

## Quotazioni e Secret

Il workflow usa il Secret GitHub `TICKBASE_API_KEY` per aggiornare il cambio USD/EUR senza esporre la chiave nel browser. Le quotazioni dei metalli vengono recuperate da Gold-API; se una fonte non è disponibile, il client prova le fonti di riserva e infine la cache locale recente.

Il generatore e il browser verificano la data effettiva del cambio (`as_of`), non la data di creazione del file (`generated_at`). Dati senza data valida, futuri o più vecchi di quattro giorni vengono scartati; la finestra copre anche fine settimana e festività. Se TickBase restituisce un cambio vecchio, vengono provati open.er-api.com e Frankfurter. Il browser applica lo stesso controllo anche ai file già pubblicati e alle quotazioni dei metalli. La fonte mostrata corrisponde al cambio realmente utilizzato e “Dati di mercato al” indica la data più vecchia fra metalli e cambio, in ora italiana.

Il deployment recupera anche i metalli e scrive `data/metal-prices.json`. La build calcola i prezzi con le stesse formule del browser e li inserisce nell’HTML, insieme alla data e alla fonte: le quotazioni sono leggibili anche senza JavaScript. Un unico script, con nome basato sul contenuto, include le formule e l’aggiornamento ogni cinque minuti, senza richieste separate ai moduli JavaScript. I dati iniziali e la cache di emergenza scadono dopo tre ore dalla loro creazione: il browser sceglie la riserva valida più recente, la indica come “ULTIMO DATO” e non ne rinnova la scadenza. Se anche questa scade, mostra “N/D”. Senza JavaScript restano i valori storici alla data visibile, indicati come “QUOTAZIONE PUBBLICATA”.

Il risultato del calcolatore è indicativo e non costituisce un’offerta vincolante. La proposta definitiva richiede la verifica del materiale in negozio.

## Pubblicazione

Il branch `main` viene pubblicato su GitHub Pages:

- a ogni push su `main`;
- ogni ora per rigenerare i dati;
- manualmente tramite `workflow_dispatch`.

Prima del deployment il workflow esegue test e controlli sintattici. Se l’aggiornamento del cambio o dei metalli fallisce, oppure se i dati iniziali non sono validi, il job fallisce e GitHub Pages conserva l’ultimo deployment valido. Le GitHub Actions sono bloccate a commit SHA verificati.

Il pacchetto pubblico include HTML con quotazioni, CSS, bundle JavaScript, immagini, dati pubblici, CNAME, sitemap e robots.txt. Nessuna chiave API è inclusa nel pacchetto.

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
