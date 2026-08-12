import {
 TROY_OUNCE_GRAMS,
 SOGLIA_PROMO_GRAMMI,
 calcolaPrezziDaMercato
} from './pricing.mjs';

/* Quotazioni oro e argento e calcolatore */
const INTERVALLO_AGGIORNAMENTO_MS = 5 * 60 * 1000;
const INTERVALLO_CAMBIO_STATICO_MS = 60 * 60 * 1000;
const CACHE_KEY_PREZZI = 'emerald-metals-live-prices-v7';
const CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const priceGold18Element = document.getElementById('price-gold18');
const priceGold24Element = document.getElementById('price-gold24');
const priceSilver800Element = document.getElementById('price-silver800');
const updatedElement = document.getElementById('metals-updated');
const sourceElement = document.getElementById('metals-source');
const liveBadgeElement = document.getElementById('metals-live-badge');
const liveTextElement = document.getElementById('metals-live-text');
const gramsInput = document.getElementById('metal-grams');
const totalElement = document.getElementById('metal-total');
const converterTitleElement = document.getElementById('converter-title');
const converterNoteElement = document.getElementById('converter-note');
const calculatorToggle = document.getElementById('calculator-toggle');
const calculatorToggleLabel = document.getElementById('calculator-toggle-label');
const calculatorPanel = document.getElementById('metals-converter');
const calculatorStage = document.getElementById('calculator-stage');
const quoteStage = document.getElementById('simple-metals-grid-stage');
const goldKaratButtons = document.querySelectorAll('.gold-karat-option');
const goldViews = document.querySelectorAll('.gold-view');
const goldPanel = document.getElementById('gold-simple-panel');
const silverPanel = document.getElementById('silver-simple-panel');
const calculatorAssetButtons = document.querySelectorAll('.calculator-asset-option');
const goldPanelTitle = document.getElementById('gold-panel-title');
const gold18OfferTitle = document.getElementById('gold18-offer-title');
const gold18OfferText = document.getElementById('gold18-offer-text');

let prezzoStandard18EurGrammo = null;
let prezzoPromo18EurGrammo = null;
let prezzoOroPuroEurGrammo = null;
let prezzoArgento800EurGrammo = null;
let ultimoAggiornamentoPrezzo = null;
let currentAsset = 'gold18';
let currentGoldAsset = 'gold18';
let usingCachedPrices = false;
let currentMarketSource = 'Dati di mercato';
let currentPriceMode = 'spot';

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), timeoutMs);
 try {
 const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
 if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
 return await response.json();
 } finally {
 clearTimeout(timeout);
 }
}

function parseMarketDate(value) {
 if (value === null || value === undefined || value === '') return new Date();
 if (typeof value === 'number') {
  // Alcune API restituiscono timestamp in secondi, altre in millisecondi.
  const ms = value < 1000000000000 ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? new Date() : date;
 }
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function caricaPrezzoMetalloGoldApi(symbol) {
 const data = await fetchJsonWithTimeout(`https://api.gold-api.com/price/${symbol}`);
 const price = Number(data && data.price);
 if (!Number.isFinite(price) || price <= 0) throw new Error(`Prezzo ${symbol} non disponibile`);
 return {
  value: price,
  asOf: parseMarketDate(data.timestamp || data.updatedAt || data.date || data.time),
  source: `Gold-API ${symbol}`
 };
}

async function caricaMercatoDaTickBaseStatico() {
 // V83: il browser aggiorna oro e argento da Gold-API ogni 60 secondi.
 // Il file JSON contiene soprattutto il cambio USD/EUR TickBase, rigenerato da GitHub Actions ogni ora.
 // La chiave TickBase resta nei Secrets del repository e non arriva mai al browser.
 const cacheBuster = Math.floor(Date.now() / INTERVALLO_CAMBIO_STATICO_MS);
 const [data, oro, argento] = await Promise.all([
  fetchJsonWithTimeout(`data/market-prices.json?v=${cacheBuster}`, 12000),
  caricaPrezzoMetalloGoldApi('XAU'),
  caricaPrezzoMetalloGoldApi('XAG')
 ]);
 const cambioUsdEur = Number(data && data.usd_eur);
 if (!data || data.success !== true || !Number.isFinite(cambioUsdEur) || cambioUsdEur <= 0) {
  throw new Error((data && data.message) || 'Cambio TickBase non ancora disponibile');
 }
 const oroEurOncia = oro.value * cambioUsdEur;
 const argentoEurOncia = argento.value * cambioUsdEur;
 if (![oroEurOncia, argentoEurOncia].every(value => Number.isFinite(value) && value > 0)) {
  throw new Error('Quotazioni Gold-API non valide');
 }
 const metalliAsOf = [oro.asOf, argento.asOf]
  .filter(date => date instanceof Date && !Number.isNaN(date.getTime()))
  .sort((a, b) => a.getTime() - b.getTime())[0] || new Date();
 return {
  oroEurOncia,
  argentoEurOncia,
  asOf: metalliAsOf,
  stale: Boolean(data.stale),
  provider: 'Gold-API live + TickBase FX',
  mode: 'spot'
 };
}

async function caricaCambioUsdEurFallback() {
 const providers = [
  async () => {
   const data = await fetchJsonWithTimeout('https://open.er-api.com/v6/latest/USD');
   return Number(data && data.rates && data.rates.EUR);
  },
  async () => {
   const data = await fetchJsonWithTimeout('https://api.frankfurter.app/latest?from=USD&to=EUR');
   return Number(data && data.rates && data.rates.EUR);
  }
 ];

 for (const provider of providers) {
  try {
   const rate = await provider();
   if (Number.isFinite(rate) && rate > 0) return rate;
  } catch (error) {
   console.warn('Provider cambio di riserva non disponibile:', error);
  }
 }
 throw new Error('Cambio USD/EUR non disponibile');
}

async function caricaPrezzoMetalloUsdOnciaFallback(symbol) {
 const metal = await caricaPrezzoMetalloGoldApi(symbol);
 return metal.value;
}

async function caricaMercatoFallback() {
 const [cambioUsdEur, prezzoOroUsdOncia, prezzoArgentoUsdOncia] = await Promise.all([
  caricaCambioUsdEurFallback(),
  caricaPrezzoMetalloUsdOnciaFallback('XAU'),
  caricaPrezzoMetalloUsdOnciaFallback('XAG')
 ]);
 return {
  oroEurOncia: prezzoOroUsdOncia * cambioUsdEur,
  argentoEurOncia: prezzoArgentoUsdOncia * cambioUsdEur,
  asOf: new Date(),
  stale: false,
  provider: 'Fonti di riserva',
  mode: 'spot'
 };
}

async function caricaDatiMercato() {
 try {
  return await caricaMercatoDaTickBaseStatico();
 } catch (error) {
  console.warn('Cambio TickBase o metalli live non disponibili; uso fonti di riserva:', error);
  return await caricaMercatoFallback();
 }
}

function formatEuro(value, minDigits = 2, maxDigits = 2) {
 if (!Number.isFinite(value)) return 'N/D';
 return value.toLocaleString('it-IT', {
 minimumFractionDigits: minDigits,
 maximumFractionDigits: maxDigits
 });
}

function formatEuroPrezzo18(value) {
 if (!Number.isFinite(value)) return 'N/D';
 return formatEuro(value, 1, 1);
}

function getGrammiInseriti() {
 if (!gramsInput) return 0;
 return Number(String(gramsInput.value).replace(',', '.')) || 0;
}

function isPromoApplicabile(grammi) {
 return grammi >= SOGLIA_PROMO_GRAMMI;
}

function getPrezzoAssetPerGrammi(asset, grammi) {
 if (asset === 'silver800') return prezzoArgento800EurGrammo;
 return isPromoApplicabile(grammi) ? prezzoPromo18EurGrammo : prezzoStandard18EurGrammo;
}

function salvaPrezziInCache() {
 if (![prezzoOroPuroEurGrammo, prezzoStandard18EurGrammo, prezzoPromo18EurGrammo, prezzoArgento800EurGrammo].every(Number.isFinite)) return;
 try {
 localStorage.setItem(CACHE_KEY_PREZZI, JSON.stringify({
 cachedAt: Date.now(),
 sourceTimestamp: ultimoAggiornamentoPrezzo instanceof Date ? ultimoAggiornamentoPrezzo.getTime() : Date.now(),
 prezzo24: prezzoOroPuroEurGrammo,
 standard18: prezzoStandard18EurGrammo,
 promo18: prezzoPromo18EurGrammo,
 argento800: prezzoArgento800EurGrammo,
 source: currentMarketSource,
 priceMode: currentPriceMode
 }));
 } catch (error) {
 console.warn('Cache prezzi non salvata:', error);
 }
}

function caricaPrezziDaCache() {
 try {
 const raw = localStorage.getItem(CACHE_KEY_PREZZI);
 if (!raw) return false;
 const cached = JSON.parse(raw);
 const cachedAt = Number(cached && (cached.cachedAt || cached.timestamp));
 const sourceTimestamp = Number(cached && (cached.sourceTimestamp || cached.timestamp || cachedAt));
 const isFresh = Number.isFinite(cachedAt) && (Date.now() - cachedAt) <= CACHE_MAX_AGE_MS;
 const valuesValid = cached && [cached.prezzo24, cached.standard18, cached.promo18, cached.argento800].every(Number.isFinite);
 if (!isFresh || !valuesValid) return false;
 prezzoOroPuroEurGrammo = cached.prezzo24;
 prezzoStandard18EurGrammo = cached.standard18;
 prezzoPromo18EurGrammo = cached.promo18;
 prezzoArgento800EurGrammo = cached.argento800;
 ultimoAggiornamentoPrezzo = new Date(sourceTimestamp);
 currentMarketSource = cached.source || 'Ultimo dato salvato';
 currentPriceMode = cached.priceMode || 'spot';
 usingCachedPrices = true;
 return true;
 } catch (error) {
 console.warn('Cache prezzi non leggibile:', error);
 return false;
 }
}

function aggiornaStatoLive() {
 if (updatedElement) {
 updatedElement.textContent = ultimoAggiornamentoPrezzo instanceof Date && !Number.isNaN(ultimoAggiornamentoPrezzo.getTime())
 ? ultimoAggiornamentoPrezzo.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' })
 : '--:--:--';
 }
 if (liveTextElement) liveTextElement.textContent = usingCachedPrices ? 'ULTIMO DATO' : 'AGGIORNATO';
 if (sourceElement) sourceElement.textContent = currentMarketSource;
 if (liveBadgeElement) {
  liveBadgeElement.classList.toggle('cached', usingCachedPrices);
  const modeLabel = currentPriceMode === 'bid' ? 'prezzo bid' : 'prezzo spot';
  liveBadgeElement.title = `${currentMarketSource} Â· ${modeLabel}`;
 }
}

function aggiornaSchedePrezzi() {
 if (priceGold18Element) priceGold18Element.textContent = formatEuroPrezzo18(prezzoPromo18EurGrammo);
 if (priceGold24Element) priceGold24Element.textContent = formatEuro(prezzoOroPuroEurGrammo, 2, 2);
 if (priceSilver800Element) priceSilver800Element.textContent = formatEuro(prezzoArgento800EurGrammo, 2, 2);
 if (gold18OfferTitle) {
 gold18OfferTitle.textContent = `Offerta ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} â‚¬/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi`;
 }
 if (gold18OfferText) {
 gold18OfferText.textContent = `Sotto i ${SOGLIA_PROMO_GRAMMI} grammi: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} â‚¬/g. Prezzi giÃ  comprensivi delle commissioni.`;
 }
}

function getAssetLabel(asset) {
 if (asset === 'gold24') return 'Oro 24Kt';
 if (asset === 'silver800') return 'Argento 800';
 return 'Oro 18Kt';
}

function aggiornaConversione() {
 if (!gramsInput || !totalElement) return;
 const grammi = getGrammiInseriti();
 const prezzo = getPrezzoAssetPerGrammi(currentAsset, grammi);
 if (!Number.isFinite(prezzo)) {
 totalElement.textContent = 'N/D';
 if (converterNoteElement) converterNoteElement.textContent = 'Quotazione temporaneamente non disponibile. Riprova tra poco o richiedi una valutazione.';
 return;
 }

 const totale = grammi * prezzo;
 totalElement.textContent = currentAsset === 'gold18'
 ? `${formatEuro(totale, 1, 1)} â‚¬`
 : `${formatEuro(totale, 2, 2)} â‚¬`;

 if (!converterNoteElement) return;
 if (currentAsset === 'gold18') {
 if (isPromoApplicabile(grammi)) {
 converterNoteElement.textContent = `Offerta applicata: ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} â‚¬/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi.`;
 } else {
 const mancanti = Math.max(SOGLIA_PROMO_GRAMMI - grammi, 0);
 converterNoteElement.textContent = `Prezzo sotto soglia: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} â‚¬/g. Mancano ${formatEuro(mancanti, 1, 1)} g per l'offerta da ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} â‚¬/g.`;
 }
 } else {
 converterNoteElement.textContent = `Prezzo di acquisto dell'argento 800: ${formatEuro(prezzoArgento800EurGrammo, 2, 2)} â‚¬/g.`;
 }
}

function aggiornaSelezioneInterfaccia() {
 goldKaratButtons.forEach((button) => {
 const active = button.dataset.asset === currentGoldAsset;
 button.classList.toggle('active', active);
 button.setAttribute('aria-selected', String(active));
 button.tabIndex = active ? 0 : -1;
 });
 goldViews.forEach((view) => {
 const active = view.dataset.goldView === currentGoldAsset;
 view.classList.toggle('active', active);
 view.hidden = !active;
 });
 if (goldPanelTitle) goldPanelTitle.textContent = getAssetLabel(currentGoldAsset);
 if (goldPanel) goldPanel.classList.toggle('active', currentAsset !== 'silver800');
 if (silverPanel) silverPanel.classList.toggle('active', currentAsset === 'silver800');
 calculatorAssetButtons.forEach((button) => {
  const active = button.dataset.calculatorAsset === currentAsset;
  button.classList.toggle('active', active);
  button.setAttribute('aria-selected', String(active));
  button.tabIndex = active ? 0 : -1;
 });
 const label = getAssetLabel(currentAsset);
 if (converterTitleElement) converterTitleElement.textContent = label;
 if (calculatorPanel) {
  const isSilverTheme = currentAsset === 'silver800';
  calculatorPanel.classList.toggle('theme-silver', isSilverTheme);
  calculatorPanel.classList.toggle('theme-gold', !isSilverTheme);
  calculatorPanel.dataset.calculatorTheme = isSilverTheme ? 'silver' : 'gold';
 }
}

const smoothHeightTimers = new WeakMap();

function motionIsReduced() {
 return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function clearSmoothHeightTimer(element) {
 const timer = smoothHeightTimers.get(element);
 if (timer) window.clearTimeout(timer);
 smoothHeightTimers.delete(element);
}

function finishSmoothResize(element, stateClass) {
 clearSmoothHeightTimer(element);
 element.style.removeProperty('height');
 element.style.removeProperty('overflow');
 element.style.removeProperty('will-change');
 element.classList.remove('smooth-height-transition');
 if (stateClass) element.classList.remove(stateClass);
}

function animateMeasuredHeight(element, updateCallback, stateClass) {
 if (!element || motionIsReduced() || element.offsetParent === null) {
  updateCallback();
  return;
 }

 clearSmoothHeightTimer(element);
 const startHeight = element.getBoundingClientRect().height;
 element.style.height = `${startHeight}px`;
 element.style.overflow = 'hidden';
 element.style.willChange = 'height';
 element.classList.add('smooth-height-transition');
 if (stateClass) element.classList.remove(stateClass);

 updateCallback();

 // La misura finale viene calcolata senza mostrare il layout intermedio.
 element.style.height = 'auto';×¾y¶‰žËkºwµçQÕ• ¤¤ì4(€…±Õ±…Ñ½ÉQ½±”¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ÍÑ…Ñ”µ¡…¹¥¹œœ¤ì4(€Ù½¥…±Õ±…Ñ½ÉQ½±”¹½™™Í•Ñ]¥‘Ñ ì4(€…±Õ±…Ñ½ÉQ½±”¹±…ÍÍ1¥ÍÐ¹…‘ ÍÑ…Ñ”µ¡…¹¥¹œœ¤ì4(€Ý¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôø…±Õ±…Ñ½ÉQ½±”¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ÍÑ…Ñ”µ¡…¹¥¹œœ¤°€ÔÈÀ¤ì4(ô4)ô4(4)™Õ¹Ñ¥½¸…¹¥µ…Ñ•…±Õ±…Ñ½ÉY¥Í¥‰¥±¥Ñä¡½Á•¸¤ì4(¥˜€ ……±Õ±…Ñ½ÉA…¹•°¤É•ÑÕÉ¸ì4(½¹ÍÐÍÑ…”€ô…±Õ±…Ñ½ÉMÑ…”ñð…±Õ±…Ñ½ÉA…¹•°ì4(±•…ÉMµ½½Ñ¡!•¥¡ÑQ¥µ•È¡ÍÑ…”¤ì4(4(¥˜€¡µ½Ñ¥½¹%ÍI•‘Õ• ¤¤ì4(€…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹Ñ½±” ¥Ìµ½±±…ÁÍ•œ°€…½Á•¸¤ì4(€…±Õ±…Ñ½ÉA…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ¡¥‘‘•¸œ°MÑÉ¥¹œ …½Á•¸¤¤ì4(€É•ÑÕÉ¸ì4(ô4(4(ÍÑ…”¹±…ÍÍ1¥ÍÐ¹…‘ Á…¹•°µ¡•¥¡Ðµ…¹¥µ…Ñ¥¹œœ¤ì4(ÍÑ…”¹ÍÑå±”¹½Ù•É™±½Ü€ô€¡¥‘‘•¸œì4(ÍÑ…”¹ÍÑå±”¹Ý¥±±¡…¹”€ô€¡•¥¡Ð°½Á…¥Ñä°ÑÉ…¹Í™½É´œì4(4(¥˜€¡½Á•¸¤ì4(€…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¥Ìµ½±±…ÁÍ•œ¤ì4(€…±Õ±…Ñ½ÉA…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ¡¥‘‘•¸œ°€™…±Í”œ¤ì4(€ÍÑ…”¹ÍÑå±”¹¡•¥¡Ð€ô€…ÕÑ¼œì4(€½¹ÍÐÑ…É•Ñ!•¥¡Ð€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹¡•¥¡Ðì4(€ÍÑ…”¹ÍÑå±”¹¡•¥¡Ð€ô€œÁÁàœì4(€ÍÑ…”¹ÍÑå±”¹½Á…¥Ñä€ô€œÀœì4(€ÍÑ…”¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€ÑÉ…¹Í±…Ñ•d ´áÁà¤œì4(€Ù½¥ÍÑ…”¹½™™Í•Ñ!•¥¡Ðì4(€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôøì4(€€ÍÑ…”¹ÍÑå±”¹¡•¥¡Ð€ô€‘íÑ…É•Ñ!•¥¡ÑõÁá€ì4(€€ÍÑ…”¹ÍÑå±”¹½Á…¥Ñä€ô€œÄœì4(€€ÍÑ…”¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€ÑÉ…¹Í±…Ñ•d À¤œì4(€ô¤ì4(ô•±Í”ì4(€½¹ÍÐÍÑ…ÉÑ!•¥¡Ð€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹¡•¥¡Ðì4(€ÍÑ…”¹ÍÑå±”¹¡•¥¡Ð€ô€‘íÍÑ…ÉÑ!•¥¡ÑõÁá€ì4(€ÍÑ…”¹ÍÑå±”¹½Á…¥Ñä€ô€œÄœì4(€ÍÑ…”¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€ÑÉ…¹Í±…Ñ•d À¤œì4(€Ù½¥ÍÑ…”¹½™™Í•Ñ!•¥¡Ðì4(€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôøì4(€€ÍÑ…”¹ÍÑå±”¹¡•¥¡Ð€ô€œÁÁàœì4(€€ÍÑ…”¹ÍÑå±”¹½Á…¥Ñä€ô€œÀœì4(€€ÍÑ…”¹ÍÑå±”¹ÑÉ…¹Í™½É´€ô€ÑÉ…¹Í±…Ñ•d ´ÝÁà¤œì4(€ô¤ì4(ô4(4(½¹ÍÐÑ¥µ•È€ôÝ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôøì4(€¥˜€ …½Á•¸¤…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹…‘ ¥Ìµ½±±…ÁÍ•œ¤ì4(€ÍÑ…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ¡•¥¡Ðœ¤ì4(€ÍÑ…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ½Á…¥Ñäœ¤ì4(€ÍÑ…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ÑÉ…¹Í™½É´œ¤ì4(€ÍÑ…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ½Ù•É™±½Üœ¤ì4(€ÍÑ…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä Ý¥±°µ¡…¹”œ¤ì4(€ÍÑ…”¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” Á…¹•°µ¡•¥¡Ðµ…¹¥µ…Ñ¥¹œœ¤ì4(€Íµ½½Ñ¡!•¥¡ÑQ¥µ•ÉÌ¹‘•±•Ñ”¡ÍÑ…”¤ì4(ô°€ÔÐÀ¤ì4(Íµ½½Ñ¡!•¥¡ÑQ¥µ•ÉÌ¹Í•Ð¡ÍÑ…”°Ñ¥µ•È¤ì4)ô4(4)¥˜€¡…±Õ±…Ñ½ÉQ½±”€˜˜…±Õ±…Ñ½ÉA…¹•°¤ì4(…±Õ±…Ñ½ÉA…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ¡¥‘‘•¸œ°MÑÉ¥¹œ¡…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ¥Ìµ½±±…ÁÍ•œ¤¤¤ì4(…±Õ±…Ñ½ÉQ½±”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì4(½¹ÍÐÝ¥±±=Á•¸€ô…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ¥Ìµ½±±…ÁÍ•œ¤ì4(…¹¥µ…Ñ•…±Õ±…Ñ½ÉY¥Í¥‰¥±¥Ñä¡Ý¥±±=Á•¸¤ì4(ÕÁ‘…Ñ•…±Õ±…Ñ½ÉQ½±•MÑ…Ñ”¡Ý¥±±=Á•¸°ÑÉÕ”¤ì4(¥˜€¡Ý¥±±=Á•¸¤…¥½É¹…½¹Ù•ÉÍ¥½¹” ¤ì4(ô¤ì4)ô4(4)¥˜€¡É…µÍ%¹ÁÕÐ¤É…µÍ%¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°…¥½É¹…½¹Ù•ÉÍ¥½¹”¤ì4(4)…É¥…AÉ•éé¥……¡” ¤ì4)…¥½É¹…Y¥ÍÑ…AÉ•éé¤ ¤ì4)…¥½É¹…AÉ•éé¥1¥Ù” ¤ì4)Ý¥¹‘½Ü¹Í•Ñ%¹Ñ•ÉÙ…°  ¤€ôø…¥½É¹…AÉ•éé¥1¥Ù” ¤°%9QIY11=}%=I959Q=}5L¤ì4)‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È Ù¥Í¥‰¥±¥Ñå¡…¹”œ°€ ¤€ôøì4(¥˜€ …‘½Õµ•¹Ð¹¡¥‘‘•¸¤…¥½É¹…AÉ•éé¥1¥Ù” ¤ì4)ô¤ì4(4(4(¼¨9…Ù¥…é¥½¹”¥¹Ñ•É¹„XÔÄè¹•ÍÍÕ¹¼é½½´¸4(%°‰±½¼Ù¥•¹”•¹ÑÉ…Ñ¼¹•±±¼ÍÁ…é¥¼É•…±µ•¹Ñ”‘¥ÍÁ½¹¥‰¥±”Í½ÑÑ¼±„¹…Ù‰…Èì4(ÅÕ…¹‘¼ƒ Á§ä…±Ñ¼‘•±±¼Í¡•Éµ¼Ù¥•¹”…±±¥¹•…Ñ¼…±°¥¹¥é¥¼°Í•¹é„µ½‘¥™¥…É¹”±„Í…±„¸€¨¼4)½¹ÍÐ9Y}QIQ}!%!1%!Q}1ML€ô€¹…ØµÑ…É•Ðµ¡¥¡±¥¡Ðœì)½¹ÍÐ9Y}QIQ}!%!1%!Q}5L€ô€äÀÀì)±•Ð¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ€ô¹Õ±°ì)±•Ð¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð€ô¹Õ±°ì)±•Ð¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”€ô¹Õ±°ì4(4)™Õ¹Ñ¥½¸Íå¹¥á•‘!•…‘•ÉMÁ…” ¤ì4(½¹ÍÐ™¥á•‘!•…‘•È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Í¥Ñ”µ¡•…‘•Èœ¤ì4(¥˜€ …™¥á•‘!•…‘•È¤É•ÑÕÉ¸ì4(½¹ÍÐ¡•¥¡Ð€ô5…Ñ ¹•¥°¡™¥á•‘!•…‘•È¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹¡•¥¡Ð¤ì4(‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä œ´µÍ¥Ñ”µ¡•…‘•Èµ¡•¥¡Ðœ°€‘í¡•¥¡ÑõÁá€¤ì4)ô4(4)Íå¹¥á•‘!•…‘•ÉMÁ…” ¤ì4)Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±½…œ°Íå¹¥á•‘!•…‘•ÉMÁ…”°ì½¹”èÑÉÕ”ô¤ì4)Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È É•Í¥é”œ°Íå¹¥á•‘!•…‘•ÉMÁ…”°ìÁ…ÍÍ¥Ù”èÑÉÕ”ô¤ì4)¥˜€¡ÑåÁ•½˜I•Í¥é•=‰Í•ÉÙ•È€ôôô€™Õ¹Ñ¥½¸œ¤ì4(½¹ÍÐ™¥á•‘!•…‘•È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Í¥Ñ”µ¡•…‘•Èœ¤ì4(¥˜€¡™¥á•‘!•…‘•È¤¹•ÜI•Í¥é•=‰Í•ÉÙ•È¡Íå¹¥á•‘!•…‘•ÉMÁ…”¤¹½‰Í•ÉÙ”¡™¥á•‘!•…‘•È¤ì4)ô4(4)™Õ¹Ñ¥½¸•Ñ9…Ù!¥¡±¥¡ÑQ…É•Ð¡Ñ…É•Ñ%¤ì4(€¼¨!½µ”Ñ½É¹„¥¸¥µ„°µ„°•™™•ÑÑ¼±Õµ¥¹½Í¼‘•Ù”•ÍÍ•É”Ù¥Í¥‰¥±”ÍÕ°½¹Ñ•¹ÕÑ¼4(€€€ÁÉ¥¹¥Á…±””¹½¸ÍÕ±±„¹…Ù‰…ÈÍÑ¥­ä¸€¨¼4(¥˜€¡Ñ…É•Ñ%€ôôô€œÑ½Àœ¤ì4(€É•ÑÕÉ¸‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œÅÕ½Ñ…é¥½¹”œ¤ñð‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Á…”€øÍ•Ñ¥½¸œ¤ì4(ô4(É•ÑÕÉ¸‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È¡Ñ…É•Ñ%¤ì4)ô4(4)™Õ¹Ñ¥½¸±•…É9…ÙQ…É•Ñ!¥¡±¥¡Ð ¤ì(¥˜€¡¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ¤ì(Ý¥¹‘½Ü¹±•…ÉQ¥µ•½ÕÐ¡¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ¤ì(¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ€ô¹Õ±°ì(ô(4(¥˜€¡¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð¤ì4(¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù”¡9Y}QIQ}!%!1%!Q}1ML¤ì4(¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð€ô¹Õ±°ì4(ô4(4(‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±°¡€¸‘í9Y}QIQ}!%!1%!Q}1MMõ€¤¹™½É…  ¡•±•µ•¹Ð¤€ôøì4(•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù”¡9Y}QIQ}!%!1%!Q}1ML¤ì4(ô¤ì4)ô4(4)™Õ¹Ñ¥½¸¡¥¡±¥¡Ñ9…ÙQ…É•Ð¡Ñ…É•Ñ%¤ì4(½¹ÍÐ•±•µ•¹Ð€ô•Ñ9…Ù!¥¡±¥¡ÑQ…É•Ð¡Ñ…É•Ñ%¤ì4(¥˜€ …•±•µ•¹Ð¤É•ÑÕÉ¸ì4(4(±•…É9…ÙQ…É•Ñ!¥¡±¥¡Ð ¤ì4(•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘¡9Y}QIQ}!%!1%!Q}1ML¤ì(¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð€ô•±•µ•¹Ðì(¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ€ôÝ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôøì(•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù”¡9Y}QIQ}!%!1%!Q}1ML¤ì(¥˜€¡¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð€ôôô•±•µ•¹Ð¤¹…Ù!¥¡±¥¡Ñ±•µ•¹Ð€ô¹Õ±°ì(¹…Ù!¥¡±¥¡ÑQ¥µ•½ÕÐ€ô¹Õ±°ì(ô°9Y}QIQ}!%!1%!Q}5L¤ì)ô(4)™Õ¹Ñ¥½¸Ý…¥Ñ½ÉMÉ½±±Q¡•¹!¥¡±¥¡Ð¡Ñ…É•Ñ%°•áÁ•Ñ•‘Q½À¤ì4(¥˜€¡¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”¤…¹•±¹¥µ…Ñ¥½¹É…µ”¡¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”¤ì4(4(½¹ÍÐÍÑ…ÉÑ•‘Ð€ôÁ•É™½Éµ…¹”¹¹½Ü ¤ì4(±•ÐÁÉ•Ù¥½ÕÍd€ôÝ¥¹‘½Ü¹Á…•e=™™Í•Ðì4(±•ÐÍÑ…‰±•É…µ•Ì€ô€Àì4(4(™Õ¹Ñ¥½¸¡•­A½Í¥Ñ¥½¸¡¹½Ü¤ì4(½¹ÍÐÕÉÉ•¹Ñd€ôÝ¥¹‘½Ü¹Á…•e=™™Í•Ðì4(½¹ÍÐµ½Ù•µ•¹Ð€ô5…Ñ ¹…‰Ì¡ÕÉÉ•¹Ñd€´ÁÉ•Ù¥½ÕÍd¤ì4(½¹ÍÐ‘¥ÍÑ…¹”€ô5…Ñ ¹…‰Ì¡ÕÉÉ•¹Ñd€´•áÁ•Ñ•‘Q½À¤ì4(4(¥˜€¡µ½Ù•µ•¹Ð€ð€¸Øñð‘¥ÍÑ…¹”€ð€È¤ÍÑ…‰±•É…µ•Ì€¬ô€Äì4(•±Í”ÍÑ…‰±•É…µ•Ì€ô€Àì4(ÁÉ•Ù¥½ÕÍd€ôÕÉÉ•¹Ñdì4(4(¥˜€ ¡‘¥ÍÑ…¹”€ð€Ì€˜˜ÍÑ…‰±•É…µ•Ì€øô€Ì¤ñð¹½Ü€´ÍÑ…ÉÑ•‘Ð€ø€ÄØÀÀ¤ì4(¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”€ô¹Õ±°ì4(¡¥¡±¥¡Ñ9…ÙQ…É•Ð¡Ñ…É•Ñ%¤ì4(É•ÑÕÉ¸ì4(ô4(4(¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”€ôÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”¡¡•­A½Í¥Ñ¥½¸¤ì4(ô4(4(¹…ÙMÉ½±±¹¥µ…Ñ¥½¹É…µ”€ôÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”¡¡•­A½Í¥Ñ¥½¸¤ì4)ô4(4)™Õ¹Ñ¥½¸…±Õ±…Ñ•M•Ñ¥½¹MÉ½±±Q½À¡Ñ…É•Ñ%°Ñ…É•Ð¤ì4(¥˜€¡Ñ…É•Ñ%€ôôô€œÑ½Àœ¤É•ÑÕÉ¸€Àì4(4(½¹ÍÐ¡•…‘•È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Í¥Ñ”µ¡•…‘•Èœ¤ì4(½¹ÍÐ¡•…‘•É!•¥¡Ð€ô¡•…‘•È€ü¡•…‘•È¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹¡•¥¡Ð€è€Àì4(½¹ÍÐ¡•…‘•ÉQ½À€ô€ÄØì4(½¹ÍÐ…Á	•±½Ý!•…‘•È€ô€Äàì4(½¹ÍÐ‰½ÑÑ½µ…À€ô€Äàì4(½¹ÍÐÙ¥•ÝÁ½ÉÑ½¹Ñ•¹ÑQ½À€ô¡•…‘•ÉQ½À€¬¡•…‘•É!•¥¡Ð€¬…Á	•±½Ý!•…‘•Èì4(½¹ÍÐ…Ù…¥±…‰±•!•¥¡Ð€ô5…Ñ ¹µ…à ÈàÀ°Ý¥¹‘½Ü¹¥¹¹•É!•¥¡Ð€´Ù¥•ÝÁ½ÉÑ½¹Ñ•¹ÑQ½À€´‰½ÑÑ½µ…À¤ì4(½¹ÍÐÉ•Ð€ôÑ…É•Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì4(½¹ÍÐÑ…É•Ñ½Õµ•¹ÑQ½À€ôÉ•Ð¹Ñ½À€¬Ý¥¹‘½Ü¹Á…•e=™™Í•Ðì4(½¹ÍÐÑ…É•Ñ!•¥¡Ð€ôÉ•Ð¹¡•¥¡Ðì4(4(€¼¨M”•¹ÑÉ„¹•±±¼Í¡•Éµ¼°±¼•¹ÑÉ„èÍ¤Ù•‘”¥µµ•‘¥…Ñ…µ•¹Ñ”ÑÕÑÑ¼¥°ÅÕ…‘É…Ñ¼¸4(M”¹½¸•¹ÑÉ„€¡Ñ¥Á¥…µ•¹Ñ”ÍÔµ½‰¥±”¤°±¼…±±¥¹•„…±°¥¹¥é¥¼”±…Í¥„±¼ÍÉ½±°¹½Éµ…±”¸€¨¼4(½¹ÍÐ•¹Ñ•É¥¹=™™Í•Ð€ôÑ…É•Ñ!•¥¡Ð€ðô…Ù…¥±…‰±•!•¥¡Ð4(€ü5…Ñ ¹µ…à ¡…Ù…¥±…‰±•!•¥¡Ð€´Ñ…É•Ñ!•¥¡Ð¤€¼€È°€À¤4(€è€Àì4(4(½¹ÍÐÉ•ÅÕ•ÍÑ•‘Q½À€ô5…Ñ ¹µ…à¡Ñ…É•Ñ½Õµ•¹ÑQ½À€´Ù¥•ÝÁ½ÉÑ½¹Ñ•¹ÑQ½À€´•¹Ñ•É¥¹=™™Í•Ð°€À¤ì4(½¹ÍÐµ…áMÉ½±±Q½À€ô5…Ñ ¹µ…à¡‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹ÍÉ½±±!•¥¡Ð€´Ý¥¹‘½Ü¹¥¹¹•É!•¥¡Ð°€À¤ì4(É•ÑÕÉ¸5…Ñ ¹µ¥¸¡É•ÅÕ•ÍÑ•‘Q½À°µ…áMÉ½±±Q½À¤ì4)ô4(4)™Õ¹Ñ¥½¸ÍÉ½±±Q½M•Ñ¥½¹Y¥•Ü¡Ñ…É•Ñ%°¡¥¡±¥¡Ñ™Ñ•ÉMÉ½±°€ôÑÉÕ”¤ì4(½¹ÍÐÑ…É•Ð€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È¡Ñ…É•Ñ%¤ì4(¥˜€ …Ñ…É•Ð¤É•ÑÕÉ¸ì4(4(€¼¨Q½É¹…¹‘¼…±±„Í•é¥½¹”ÅÕ½Ñ…é¥½¹¤°µ…¹Ñ¥•¹¤¥°…±½±…Ñ½É”§€…Á•ÉÑ¼Á•Èµ½ÍÑÉ…É”ÍÕ‰¥Ñ¼¥°É¥ÍÕ±Ñ…Ñ¼¸€¨¼4(¥˜€¡Ñ…É•Ñ%€ôôô€œÅÕ½Ñ…é¥½¹”œ€˜˜…±Õ±…Ñ½ÉQ½±”€˜˜…±Õ±…Ñ½ÉA…¹•°¤ì4(€½¹ÍÐ…±Õ±…Ñ½É]…Í±½Í•€ô…±Õ±…Ñ½ÉA…¹•°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ¥Ìµ½±±…ÁÍ•œ¤ì4(€¥˜€¡…±Õ±…Ñ½É]…Í±½Í•¤ì4(€€…¹¥µ…Ñ•…±Õ±…Ñ½ÉY¥Í¥‰¥±¥Ñä¡ÑÉÕ”¤ì4(€€ÕÁ‘…Ñ•…±Õ±…Ñ½ÉQ½±•MÑ…Ñ”¡ÑÉÕ”°ÑÉÕ”¤ì4(€€…¥½É¹…½¹Ù•ÉÍ¥½¹” ¤ì4(€ô•±Í”ì4(€€…±Õ±…Ñ½ÉA…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ¡¥‘‘•¸œ°€™…±Í”œ¤ì4(€€ÕÁ‘…Ñ•…±Õ±…Ñ½ÉQ½±•MÑ…Ñ”¡ÑÉÕ”°™…±Í”¤ì4(€ô4(ô4(4(€¼¨±¥µ¥¹„ÅÕ…±Õ¹ÅÕ”É•Í¥‘Õ¼‘•±±„Ù•¡¥„™Õ¹é¥½¹”‘¤…ÕÑ¼µé½½´¸€¨¼4(‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° œ¹¹…Øµ…ÕÑ¼µ™¥ÐµÑ…É•Ðœ¤¹™½É…  ¡•±•µ•¹Ð¤€ôøì4(•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¹…Øµ…ÕÑ¼µ™¥ÐµÑ…É•Ðœ¤ì4(•±•µ•¹Ð¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä é½½´œ¤ì4(•±•µ•¹Ð¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä œ´µ¹…Øµ…ÕÑ¼µ™¥Ðµé½½´œ¤ì4(ô¤ì4(4(É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôøì4(½¹ÍÐÑ…É•ÑQ½À€ô…±Õ±…Ñ•M•Ñ¥½¹MÉ½±±Q½À¡Ñ…É•Ñ%°Ñ…É•Ð¤ì4(½¹ÍÐ‘¥ÍÑ…¹”€ô5…Ñ ¹…‰Ì¡Ý¥¹‘½Ü¹Á…•e=™™Í•Ð€´Ñ…É•ÑQ½À¤ì4(Ý¥¹‘½Ü¹ÍÉ½±±Q¼¡ìÑ½ÀéÑ…É•ÑQ½À°‰•¡…Ù¥½ÈèÍµ½½Ñ œô¤ì4(4(¥˜€ …¡¥¡±¥¡Ñ™Ñ•ÉMÉ½±°¤É•ÑÕÉ¸ì4(¥˜€¡‘¥ÍÑ…¹”€ð€Ð¤ì4(Ý¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôø¡¥¡±¥¡Ñ9…ÙQ…É•Ð¡Ñ…É•Ñ%¤°€äÀ¤ì4(ô•±Í”ì4(Ý…¥Ñ½ÉMÉ½±±Q¡•¹!¥¡±¥¡Ð¡Ñ…É•Ñ%°Ñ…É•ÑQ½À¤ì4(ô4(ô¤ì4)ô4(4)‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° œ¹¹…Øµ±¥¹­Ì…m¡É•™xôˆŒ‰tœ¤¹™½É…  ¡±¥¹¬¤€ôøì4(±¥¹¬¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€¡•Ù•¹Ð¤€ôøì4(½¹ÍÐÑ…É•Ñ%€ô±¥¹¬¹•ÑÑÑÉ¥‰ÕÑ” ¡É•˜œ¤ì4(¥˜€ …Ñ…É•Ñ%¤É•ÑÕÉ¸ì4(•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì4(4(‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° œ¹¹…Øµ±¥¹­Ì„œ¤¹™½É…  ¡¹…Ù1¥¹¬¤€ôø¹…Ù1¥¹¬¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” …Ñ¥Ù”œ¤¤ì4(±¥¹¬¹±…ÍÍ1¥ÍÐ¹…‘ …Ñ¥Ù”œ¤ì4(4(¥˜€¡¡¥ÍÑ½Éä¹É•Á±…•MÑ…Ñ”¤¡¥ÍÑ½Éä¹É•Á±…•MÑ…Ñ”¡¹Õ±°°€œœ°Ñ…É•Ñ%¤ì4(•±Í”Ý¥¹‘½Ü¹±½…Ñ¥½¸¹¡…Í €ôÑ…É•Ñ%ì4(4(ÍÉ½±±Q½M•Ñ¥½¹Y¥•Ü¡Ñ…É•Ñ%°ÑÉÕ”¤ì4(ô¤ì4)ô¤ì4(4)Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±½…œ°€ ¤€ôøì4(¥˜€¡Ý¥¹‘½Ü¹±½…Ñ¥½¸¹¡…Í €˜˜‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È¡Ý¥¹‘½Ü¹±½…Ñ¥½¸¹¡…Í ¤¤ì4(Í•ÑQ¥µ•½ÕÐ  ¤€ôøÍÉ½±±Q½M•Ñ¥½¹Y¥•Ü¡Ý¥¹‘½Ü¹±½…Ñ¥½¸¹¡…Í °ÑÉÕ”¤°€ÔÀ¤ì4(ô4)ô¤ì4(4(4(¼¨5•¹Ôµ½‰¥±”XØà€¨¼4(¡™Õ¹Ñ¥½¸Í•ÑÕÁ5½‰¥±•9…Ù¥…Ñ¥½¸ ¥ì4(½¹ÍÐ¡•…‘•È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Í¥Ñ”µ¡•…‘•Èœ¤ì4(½¹ÍÐÑ½±”€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹µ½‰¥±”µµ•¹ÔµÑ½±”œ¤ì4(½¹ÍÐ¹…Ø€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÁÉ¥µ…Éäµ¹…Ù¥…Ñ¥½¸œ¤ì4(¥˜€ …¡•…‘•Èñð€…Ñ½±”ñð€…¹…Ø¤É•ÑÕÉ¸ì4(4(½¹ÍÐµ½‰¥±•EÕ•Éä€ôÝ¥¹‘½Ü¹µ…Ñ¡5•‘¥„ œ¡µ…àµÝ¥‘Ñ èÜÀÁÁà¤œ¤ì4(4(™Õ¹Ñ¥½¸Í•Ñ5•¹Ô¡½Á•¸¥ì4(€½¹ÍÐÍ¡½Õ±‘=Á•¸€ô	½½±•…¸¡½Á•¸€˜˜µ½‰¥±•EÕ•Éä¹µ…Ñ¡•Ì¤ì4(€¡•…‘•È¹±…ÍÍ1¥ÍÐ¹Ñ½±” µ•¹Ôµ½Á•¸œ°Í¡½Õ±‘=Á•¸¤ì4(€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ•áÁ…¹‘•œ°MÑÉ¥¹œ¡Í¡½Õ±‘=Á•¸¤¤ì4(€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ±…‰•°œ°Í¡½Õ±‘=Á•¸€ü€¡¥Õ‘¤¥°µ•¹Ôœ€è€ÁÉ¤¥°µ•¹Ôœ¤ì4(ô4(4(Ñ½±”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€¡•Ù•¹Ð¤€ôøì4(€•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì4(€Í•Ñ5•¹Ô …¡•…‘•È¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì µ•¹Ôµ½Á•¸œ¤¤ì4(ô¤ì4(4(¹…Ø¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€¡•Ù•¹Ð¤€ôøì4(€¥˜€¡•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ „œ¤¤Í•Ñ5•¹Ô¡™…±Í”¤ì4(ô¤ì4(4(‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€¡•Ù•¹Ð¤€ôøì4(€¥˜€¡¡•…‘•È¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì µ•¹Ôµ½Á•¸œ¤€˜˜€…¡•…‘•È¹½¹Ñ…¥¹Ì¡•Ù•¹Ð¹Ñ…É•Ð¤¤Í•Ñ5•¹Ô¡™…±Í”¤ì4(ô¤ì4(4(‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ­•å‘½Ý¸œ°€¡•Ù•¹Ð¤€ôøì4(€¥˜€¡•Ù•¹Ð¹­•ä€ôôô€Í…Á”œ¤ì4(€€Í•Ñ5•¹Ô¡™…±Í”¤ì4(€€Ñ½±”¹™½ÕÌ ¤ì4(€ô4(ô¤ì4(4(½¹ÍÐ¡…¹‘±•Y¥•ÝÁ½ÉÑ¡…¹”€ô€ ¤€ôøÍ•Ñ5•¹Ô¡™…±Í”¤ì4(¥˜€¡ÑåÁ•½˜µ½‰¥±•EÕ•Éä¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È€ôôô€™Õ¹Ñ¥½¸œ¤µ½‰¥±•EÕ•Éä¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¡…¹”œ°¡…¹‘±•Y¥•ÝÁ½ÉÑ¡…¹”¤ì4(•±Í”¥˜€¡ÑåÁ•½˜µ½‰¥±•EÕ•Éä¹…‘‘1¥ÍÑ•¹•È€ôôô€™Õ¹Ñ¥½¸œ¤µ½‰¥±•EÕ•Éä¹…‘‘1¥ÍÑ•¹•È¡¡…¹‘±•Y¥•ÝÁ½ÉÑ¡…¹”¤ì4)ô¤ ¤ì4(4(¼¨½¹Í•¹Í¼…¹…±åÑ¥Ìè½½±”¹…±åÑ¥ÌÙ¥•¹”…É¥…Ñ¼Í½±¼‘½Á¼Õ¸½¹Í•¹Í¼•ÍÁ±¥¥Ñ¼¸€¨¼4(¡™Õ¹Ñ¥½¸Í•ÑÕÁAÉ¥Ù…å½¹Í•¹Ð ¤ì4(½¹ÍÐ‰…¹¹•È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ½½­¥”µ‰…¹¹•Èœ¤ì4(½¹ÍÐ…•ÁÑ	ÕÑÑ½¸€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ½½­¥”µ…•ÁÐœ¤ì4(½¹ÍÐÉ•©•Ñ	ÕÑÑ½¸€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ½½­¥”µÉ•©•Ðœ¤ì4(½¹ÍÐµ…¹…•	ÕÑÑ½¸€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ½½­¥”µµ…¹…”œ¤ì4(½¹ÍÐ½¹Í•¹Ñ-•ä€ô€•µ•É…±µ…¹…±åÑ¥Ìµ½¹Í•¹ÐµØÄœì4(4(™Õ¹Ñ¥½¸ÕÁ‘…Ñ•½½±•½¹Í•¹Ð¡Ù…±Õ”¤ì4(€¥˜€¡ÑåÁ•½˜Ý¥¹‘½Ü¹Ñ…œ€„ôô€™Õ¹Ñ¥½¸œ¤É•ÑÕÉ¸ì4(€Ý¥¹‘½Ü¹Ñ…œ ½¹Í•¹Ðœ°€ÕÁ‘…Ñ”œ°ì4(€€…‘}ÍÑ½É…”èÙ…±Õ”°4(€€…‘}ÕÍ•É}‘…Ñ„èÙ…±Õ”°4(€€…‘}Á•ÉÍ½¹…±¥é…Ñ¥½¸èÙ…±Õ”°4(€€…¹…±åÑ¥Í}ÍÑ½É…”èÙ…±Õ”4(€ô¤ì4(ô4(4(™Õ¹Ñ¥½¸±½…‘¹…±åÑ¥Ì ¤ì4(€¥˜€¡‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ÍÉ¥ÁÑm‘…Ñ„µ•µ•É…±µ…¹…±åÑ¥Ítœ¤¤É•ÑÕÉ¸ì4(€Ý¥¹‘½Ü¹‘…Ñ…1…å•È€ôÝ¥¹‘½Ü¹‘…Ñ…1…å•Èñðmtì4(€Ý¥¹‘½Ü¹Ñ…œ€ô™Õ¹Ñ¥½¸Ñ…œ ¥ìÝ¥¹‘½Ü¹‘…Ñ…1…å•È¹ÁÕÍ ¡…ÉÕµ•¹ÑÌ¤ìôì4(€Ý¥¹‘½Ü¹Ñ…œ ½¹Í•¹Ðœ°€‘•™…Õ±Ðœ°ì4(€€…‘}ÍÑ½É…”è€‘•¹¥•œ°4(€€…‘}ÕÍ•É}‘…Ñ„è€‘•¹¥•œ°4(€€…‘}Á•ÉÍ½¹…±¥é…Ñ¥½¸è€‘•¹¥•œ°4(€€…¹…±åÑ¥Í}ÍÑ½É…”è€É…¹Ñ•œ4(€ô¤ì4(€Ý¥¹‘½Ü¹Ñ…œ ©Ìœ°¹•Ü…Ñ” ¤¤ì4(€Ý¥¹‘½Ü¹Ñ…œ ½¹™¥œœ°€´ÁA)9MM	aLœ°ì…¹½¹åµ¥é•}¥ÀèÑÉÕ”°…±±½Ý}½½±•}Í¥¹…±Ìè™…±Í”ô¤ì4(€½¹ÍÐÍÉ¥ÁÐ€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ÍÉ¥ÁÐœ¤ì4(€ÍÉ¥ÁÐ¹…Íå¹Œ€ôÑÉÕ”ì4(€ÍÉ¥ÁÐ¹‘…Ñ…Í•Ð¹•µ•É…±‘¹…±åÑ¥Ì€ô€ÑÉÕ”œì4(€ÍÉ¥ÁÐ¹ÍÉŒ€ô€¡ÑÑÁÌè¼½ÝÝÜ¹½½±•Ñ…µ…¹…•È¹½´½Ñ…œ½©Ìý¥õ´ÁA)9MM	aLœì4(€‘½Õµ•¹Ð¹¡•…¹…ÁÁ•¹‘¡¥±¡ÍÉ¥ÁÐ¤ì4(ô4(4(™Õ¹Ñ¥½¸Í…Ù•½¹Í•¹Ð¡Ù…±Õ”¤ì4(€½¹ÍÐ…¹…±åÑ¥Í]…Í1½…‘•€ô	½½±•…¸¡‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ÍÉ¥ÁÑm‘…Ñ„µ•µ•É…±µ…¹…±åÑ¥Ítœ¤¤ì4(€ÑÉäì±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡½¹Í•¹Ñ-•ä°Ù…±Õ”¤ìô…Ñ €¡•ÉÉ½È¤íô4(€¥˜€¡‰…¹¹•È¤‰…¹¹•È¹¡¥‘‘•¸€ôÑÉÕ”ì4(€¥˜€¡Ù…±Õ”€ôôô€…•ÁÑ•œ¤ì4(€€±½…‘¹…±åÑ¥Ì ¤ì4(€€ÕÁ‘…Ñ•½½±•½¹Í•¹Ð É…¹Ñ•œ¤ì4(€ô•±Í”ì4(€€ÕÁ‘…Ñ•½½±•½¹Í•¹Ð ‘•¹¥•œ¤ì4(€€l}„œ°€}¥œ°€}…Ðœ°€}…|ÁA)9MM	aLt¹™½É…  ¡¹…µ”¤€ôøì4(€€€‘½Õµ•¹Ð¹½½­¥”€ô€‘í¹…µ•ôôì5…àµ”ôÀìÁ…Ñ ô¼ìM…µ•M¥Ñ”õ1…á€ì4(€€ô¤ì4(€€¥˜€¡…¹…±åÑ¥Í]…Í1½…‘•¤Ý¥¹‘½Ü¹±½…Ñ¥½¸¹É•±½… ¤ì4(€ô4(ô4(4(±•Ð½¹Í•¹Ð€ô¹Õ±°ì4(ÑÉäì½¹Í•¹Ð€ô±½…±MÑ½É…”¹•Ñ%Ñ•´¡½¹Í•¹Ñ-•ä¤ìô…Ñ €¡•ÉÉ½È¤íô4(¥˜€¡½¹Í•¹Ð€ôôô€…•ÁÑ•œ¤±½…‘¹…±åÑ¥Ì ¤ì4(•±Í”¥˜€ …½¹Í•¹Ð€˜˜‰…¹¹•È¤‰…¹¹•È¹¡¥‘‘•¸€ô™…±Í”ì4(4(¥˜€¡…•ÁÑ	ÕÑÑ½¸¤…•ÁÑ	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ…Ù•½¹Í•¹Ð …•ÁÑ•œ¤¤ì4(¥˜€¡É•©•Ñ	ÕÑÑ½¸¤É•©•Ñ	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ…Ù•½¹Í•¹Ð É•©•Ñ•œ¤¤ì4(¥˜€¡µ…¹…•	ÕÑÑ½¸€˜˜‰…¹¹•È¤µ…¹…•	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì4(€‰…¹¹•È¹¡¥‘‘•¸€ô™…±Í”ì4(€É•©•Ñ	ÕÑÑ½¸ü¹™½ÕÌ ¤ì4(ô¤ì4)ô¤ ¤ì4(4(¼¨½½±”5…ÁÌÙ¥•¹”É¥¡¥•ÍÑ¼Í½±¼‘½Á¼Õ¸•ÍÑ¼•ÍÁ±¥¥Ñ¼‘•±°ÕÑ•¹Ñ”¸€¨¼4(¡™Õ¹Ñ¥½¸Í•ÑÕÁ5…Á½¹Í•¹Ð ¤ì4(½¹ÍÐ½¹Ñ…¥¹•È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% µ…Àµ½¹Ñ…¥¹•Èœ¤ì4(½¹ÍÐ‰ÕÑÑ½¸€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% µ…Àµ±½…œ¤ì4(¥˜€ …½¹Ñ…¥¹•Èñð€…‰ÕÑÑ½¸¤É•ÑÕÉ¸ì4(‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì4(€½¹ÍÐ™É…µ”€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ¥™É…µ”œ¤ì4(€™É…µ”¹Ñ¥Ñ±”€ô€5…ÁÁ„‘¤µ•É…±¥½¥•±±¤„5…Í…±¤œì4(€™É…µ”¹±½…‘¥¹œ€ô€±…éäœì4(€™É…µ”¹É•™•ÉÉ•ÉA½±¥ä€ô€¹¼µÉ•™•ÉÉ•ÈµÝ¡•¸µ‘½Ý¹É…‘”œì4(€™É…µ”¹ÍÉŒ€ô€¡ÑÑÁÌè¼½ÝÝÜ¹½½±”¹½´½µ…ÁÌýÄõY¥„­M¥Õ±¼­=É¥•¹Ñ…±”¬ÈÜØ¬äÔÀÄØ­5…Í…±¤­P­%Ñ…±¥„™½ÕÑÁÕÐõ•µ‰•œì4(€½¹Ñ…¥¹•È¹É•Á±…•¡¥±‘É•¸¡™É…µ”¤ì4(ô¤ì4)ô¤ ¤ì4(4(¼¨5…¹Ñ¥•¹”•Ù¥‘•¹Ñ”±„Í•é¥½¹”½ÉÉ•¹Ñ”…¹¡”‘ÕÉ…¹Ñ”±¼Í½ÉÉ¥µ•¹Ñ¼µ…¹Õ…±”¸€¨¼4(¡™Õ¹Ñ¥½¸Í•ÑÕÁÑ¥Ù•9…Ù¥…Ñ¥½¸ ¤ì4(¥˜€ „ %¹Ñ•ÉÍ•Ñ¥½¹=‰Í•ÉÙ•Èœ¥¸Ý¥¹‘½Ü¤¤É•ÑÕÉ¸ì4(½¹ÍÐ±¥¹­Ì€ôÉÉ…ä¹™É½´¡‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° œ¹¹…Øµ±¥¹­Ì…m¡É•™xôˆŒ‰tœ¤¤ì4(½¹ÍÐÑ…É•ÑÌ€ô±¥¹­Ì4(€€¹µ…À¡±¥¹¬€ôø€¡ì±¥¹¬°Ñ…É•Ðè‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È¡±¥¹¬¹•ÑÑÑÉ¥‰ÕÑ” ¡É•˜œ¤¤ô¤¤4(€€¹™¥±Ñ•È¡¥Ñ•´€ôø¥Ñ•´¹Ñ…É•Ð¤ì4(¥˜€ …Ñ…É•ÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸ì4(4(½¹ÍÐ½‰Í•ÉÙ•È€ô¹•Ü%¹Ñ•ÉÍ•Ñ¥½¹=‰Í•ÉÙ•È ¡•¹ÑÉ¥•Ì¤€ôøì4(€½¹ÍÐÙ¥Í¥‰±”€ô•¹ÑÉ¥•Ì4(€€€¹™¥±Ñ•È¡•¹ÑÉä€ôø•¹ÑÉä¹¥Í%¹Ñ•ÉÍ•Ñ¥¹œ¤4(€€€¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹¥¹Ñ•ÉÍ•Ñ¥½¹I…Ñ¥¼€´„¹¥¹Ñ•ÉÍ•Ñ¥½¹I…Ñ¥¼¥lÁtì4(€¥˜€ …Ù¥Í¥‰±”¤É•ÑÕÉ¸ì4(€±¥¹­Ì¹™½É…  ¡±¥¹¬¤€ôøì4(€€±¥¹¬¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” …Ñ¥Ù”œ¤ì4(€€±¥¹¬¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” …É¥„µÕÉÉ•¹Ðœ¤ì4(€ô¤ì4(€½¹ÍÐ¥Ñ•´€ôÑ…É•ÑÌ¹™¥¹¡…¹‘¥‘…Ñ”€ôø…¹‘¥‘…Ñ”¹Ñ…É•Ð€ôôôÙ¥Í¥‰±”¹Ñ…É•Ð¤ì4(€¥˜€¡¥Ñ•´¤ì4(€€¥Ñ•´¹±¥¹¬¹±…ÍÍ1¥ÍÐ¹…‘ …Ñ¥Ù”œ¤ì4(€€¥Ñ•´¹±¥¹¬¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µÕÉÉ•¹Ðœ°€Á…”œ¤ì4(€ô4(ô°ìÉ½½Ñ5…É¥¸è€œ´ÈÔ”€ÁÁà€´ØÀ”€ÁÁàœ°Ñ¡É•Í¡½±èlÀ¸ÀÔ°€À¸ÈÔ°€À¸Ùtô¤ì4(4(Ñ…É•ÑÌ¹™½É… ¡¥Ñ•´€ôø½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡¥Ñ•´¹Ñ…É•Ð¤¤ì4)ô¤ ¤ì4(