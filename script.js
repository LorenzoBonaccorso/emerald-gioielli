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
  liveBadgeElement.title = `${currentMarketSource} · ${modeLabel}`;
 }
}

function aggiornaSchedePrezzi() {
 if (priceGold18Element) priceGold18Element.textContent = formatEuroPrezzo18(prezzoPromo18EurGrammo);
 if (priceGold24Element) priceGold24Element.textContent = formatEuro(prezzoOroPuroEurGrammo, 2, 2);
 if (priceSilver800Element) priceSilver800Element.textContent = formatEuro(prezzoArgento800EurGrammo, 2, 2);
 if (gold18OfferTitle) {
 gold18OfferTitle.textContent = `Offerta ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi`;
 }
 if (gold18OfferText) {
 gold18OfferText.textContent = `Sotto i ${SOGLIA_PROMO_GRAMMI} grammi: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} €/g. Prezzi già comprensivi delle commissioni.`;
 }
}

function getAssetLabel(asset) {
 if (asset === 'gold24') return 'Oro 24K';
 if (asset === 'silver800') return 'Argento 800';
 return 'Oro 18K';
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
 ? `${formatEuro(totale, 1, 1)} €`
 : `${formatEuro(totale, 2, 2)} €`;

 if (!converterNoteElement) return;
 if (currentAsset === 'gold18') {
 if (isPromoApplicabile(grammi)) {
 converterNoteElement.textContent = `Offerta applicata: ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi.`;
 } else {
 const mancanti = Math.max(SOGLIA_PROMO_GRAMMI - grammi, 0);
 converterNoteElement.textContent = `Prezzo sotto soglia: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} €/g. Mancano ${formatEuro(mancanti, 1, 1)} g per l'offerta da ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g.`;
 }
 } else {
 converterNoteElement.textContent = `Prezzo di acquisto dell'argento 800: ${formatEuro(prezzoArgento800EurGrammo, 2, 2)} €/g.`;
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
 element.style.height = 'auto';
 const endHeight = element.getBoundingClientRect().height;
 element.style.height = `${startHeight}px`;
 void element.offsetHeight;
 if (stateClass) {
  void element.offsetWidth;
  element.classList.add(stateClass);
 }

 if (Math.abs(endHeight - startHeight) < 1) {
  const timer = window.setTimeout(() => finishSmoothResize(element, stateClass), 430);
  smoothHeightTimers.set(element, timer);
  return;
 }

 requestAnimationFrame(() => {
  element.style.height = `${endHeight}px`;
 });

 const timer = window.setTimeout(() => finishSmoothResize(element, stateClass), 520);
 smoothHeightTimers.set(element, timer);
}

function setCurrentAsset(asset) {
 const nextAsset = asset === 'silver800' ? 'silver800' : 'gold18';
 if (nextAsset === currentAsset) return;
 const previousAsset = currentAsset;

 const updateAsset = () => {
  currentAsset = nextAsset;
  if (currentAsset === 'gold18') currentGoldAsset = 'gold18';
  aggiornaSelezioneInterfaccia();
  aggiornaConversione();
 };

 animateMeasuredHeight(calculatorStage || calculatorPanel, updateAsset, 'calculator-resizing');

 if (calculatorPanel && previousAsset !== nextAsset) {
  calculatorPanel.classList.remove('theme-switching');
  void calculatorPanel.offsetWidth;
  calculatorPanel.classList.add('theme-switching');
  window.setTimeout(() => calculatorPanel.classList.remove('theme-switching'), 760);
 }
}

function setGoldView(asset) {
 const nextGoldAsset = asset === 'gold24' ? 'gold24' : 'gold18';
 if (nextGoldAsset === currentGoldAsset) return;
 const quoteGrid = goldPanel ? goldPanel.closest('.simple-metals-grid') : null;

 animateMeasuredHeight(quoteStage || quoteGrid || goldPanel, () => {
  currentGoldAsset = nextGoldAsset;
  // Il selettore 18K/24K in alto modifica solo la quotazione mostrata.
  // Il materiale del calcolatore si seleziona direttamente nel calcolatore.
  aggiornaSelezioneInterfaccia();
 }, 'quote-resizing');
}

function aggiornaVistaPrezzi() {
 aggiornaSchedePrezzi();
 aggiornaStatoLive();
 aggiornaSelezioneInterfaccia();
 aggiornaConversione();
}

let priceRefreshInFlight = false;

async function aggiornaPrezziLive() {
 if (priceRefreshInFlight || document.hidden) return;
 priceRefreshInFlight = true;
 try {
  try {
   const mercato = await caricaDatiMercato();
   const nuovoPrezzo24 = mercato.oroEurOncia / TROY_OUNCE_GRAMS;
   const nuovoPrezzoArgentoPuro = mercato.argentoEurOncia / TROY_OUNCE_GRAMS;
   if (![nuovoPrezzo24, nuovoPrezzoArgentoPuro].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Dati di mercato non validi');
   }
   const prezzi = calcolaPrezziDaMercato(nuovoPrezzo24, nuovoPrezzoArgentoPuro);
   prezzoOroPuroEurGrammo = nuovoPrezzo24;
   prezzoStandard18EurGrammo = prezzi.standard18;
   prezzoPromo18EurGrammo = prezzi.promo18;
   prezzoArgento800EurGrammo = prezzi.argento800;
   ultimoAggiornamentoPrezzo = mercato.asOf instanceof Date && !Number.isNaN(mercato.asOf.getTime())
    ? mercato.asOf
    : new Date();
   currentMarketSource = mercato.provider;
   currentPriceMode = mercato.mode;
   usingCachedPrices = Boolean(mercato.stale);
   salvaPrezziInCache();
  } catch (error) {
   console.warn('Aggiornamento prezzi non disponibile:', error);
   if (![prezzoOroPuroEurGrammo, prezzoPromo18EurGrammo, prezzoArgento800EurGrammo].every(Number.isFinite)) {
    caricaPrezziDaCache();
   } else {
    usingCachedPrices = true;
   }
  }
  aggiornaVistaPrezzi();
 } finally {
  priceRefreshInFlight = false;
 }
}

goldKaratButtons.forEach((button) => {
 button.addEventListener('click', () => setGoldView(button.dataset.asset));
});

calculatorAssetButtons.forEach((button) => {
 button.addEventListener('click', () => setCurrentAsset(button.dataset.calculatorAsset));
});

function setupTabKeyboard(buttons) {
 const items = Array.from(buttons);
 items.forEach((button, index) => {
  button.addEventListener('keydown', (event) => {
   if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
   event.preventDefault();
   let nextIndex = index;
   if (event.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
   if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
   if (event.key === 'Home') nextIndex = 0;
   if (event.key === 'End') nextIndex = items.length - 1;
   items[nextIndex].focus();
   items[nextIndex].click();
  });
 });
}

setupTabKeyboard(goldKaratButtons);
setupTabKeyboard(calculatorAssetButtons);

function updateCalculatorToggleState(open, animateState = false) {
 if (!calculatorToggle) return;
 calculatorToggle.setAttribute('aria-expanded', String(open));

 if (calculatorToggleLabel) {
  calculatorToggleLabel.textContent = open ? 'Nascondi il calcolo' : 'Calcola il valore';
  if (animateState && !motionIsReduced()) {
   calculatorToggleLabel.classList.remove('calculator-toggle-label-changing');
   void calculatorToggleLabel.offsetWidth;
   calculatorToggleLabel.classList.add('calculator-toggle-label-changing');
   window.setTimeout(() => calculatorToggleLabel.classList.remove('calculator-toggle-label-changing'), 380);
  }
 }

 if (animateState && !motionIsReduced()) {
  calculatorToggle.classList.remove('state-changing');
  void calculatorToggle.offsetWidth;
  calculatorToggle.classList.add('state-changing');
  window.setTimeout(() => calculatorToggle.classList.remove('state-changing'), 520);
 }
}

function animateCalculatorVisibility(open) {
 if (!calculatorPanel) return;
 const stage = calculatorStage || calculatorPanel;
 clearSmoothHeightTimer(stage);

 if (motionIsReduced()) {
  calculatorPanel.classList.toggle('is-collapsed', !open);
  calculatorPanel.setAttribute('aria-hidden', String(!open));
  return;
 }

 stage.classList.add('panel-height-animating');
 stage.style.overflow = 'hidden';
 stage.style.willChange = 'height, opacity, transform';

 if (open) {
  calculatorPanel.classList.remove('is-collapsed');
  calculatorPanel.setAttribute('aria-hidden', 'false');
  stage.style.height = 'auto';
  const targetHeight = stage.getBoundingClientRect().height;
  stage.style.height = '0px';
  stage.style.opacity = '0';
  stage.style.transform = 'translateY(-8px)';
  void stage.offsetHeight;
  requestAnimationFrame(() => {
   stage.style.height = `${targetHeight}px`;
   stage.style.opacity = '1';
   stage.style.transform = 'translateY(0)';
  });
 } else {
  const startHeight = stage.getBoundingClientRect().height;
  stage.style.height = `${startHeight}px`;
  stage.style.opacity = '1';
  stage.style.transform = 'translateY(0)';
  void stage.offsetHeight;
  requestAnimationFrame(() => {
   stage.style.height = '0px';
   stage.style.opacity = '0';
   stage.style.transform = 'translateY(-7px)';
  });
 }

 const timer = window.setTimeout(() => {
  if (!open) calculatorPanel.classList.add('is-collapsed');
  stage.style.removeProperty('height');
  stage.style.removeProperty('opacity');
  stage.style.removeProperty('transform');
  stage.style.removeProperty('overflow');
  stage.style.removeProperty('will-change');
  stage.classList.remove('panel-height-animating');
  smoothHeightTimers.delete(stage);
 }, 540);
 smoothHeightTimers.set(stage, timer);
}

if (calculatorToggle && calculatorPanel) {
 calculatorPanel.setAttribute('aria-hidden', String(calculatorPanel.classList.contains('is-collapsed')));
 calculatorToggle.addEventListener('click', () => {
 const willOpen = calculatorPanel.classList.contains('is-collapsed');
 animateCalculatorVisibility(willOpen);
 updateCalculatorToggleState(willOpen, true);
 if (willOpen) aggiornaConversione();
 });
}

if (gramsInput) gramsInput.addEventListener('input', aggiornaConversione);

caricaPrezziDaCache();
aggiornaVistaPrezzi();
aggiornaPrezziLive();
window.setInterval(() => aggiornaPrezziLive(), INTERVALLO_AGGIORNAMENTO_MS);
document.addEventListener('visibilitychange', () => {
 if (!document.hidden) aggiornaPrezziLive();
});


/* Navigazione interna V51: nessuno zoom.
 Il blocco viene centrato nello spazio realmente disponibile sotto la navbar;
 quando è più alto dello schermo viene allineato all'inizio, senza modificarne la scala. */
const NAV_TARGET_HIGHLIGHT_CLASS = 'nav-target-highlight';
const NAV_TARGET_HIGHLIGHT_MS = 2500;
let navHighlightAnimation = null;
let navHighlightElement = null;
let navScrollAnimationFrame = null;

function syncFixedHeaderSpace() {
 const fixedHeader = document.querySelector('.site-header');
 if (!fixedHeader) return;
 const height = Math.ceil(fixedHeader.getBoundingClientRect().height);
 document.documentElement.style.setProperty('--site-header-height', `${height}px`);
}

syncFixedHeaderSpace();
window.addEventListener('load', syncFixedHeaderSpace, { once: true });
window.addEventListener('resize', syncFixedHeaderSpace, { passive: true });
if (typeof ResizeObserver === 'function') {
 const fixedHeader = document.querySelector('.site-header');
 if (fixedHeader) new ResizeObserver(syncFixedHeaderSpace).observe(fixedHeader);
}

function getNavHighlightTarget(targetId) {
 /* Home torna in cima, ma l'effetto luminoso deve essere visibile sul contenuto
    principale e non sulla navbar sticky. */
 if (targetId === '#top') {
  return document.querySelector('#quotazione') || document.querySelector('.page > section');
 }
 return document.querySelector(targetId);
}

function clearNavTargetHighlight() {
 if (navHighlightAnimation) {
 navHighlightAnimation.cancel();
 navHighlightAnimation = null;
 }

 if (navHighlightElement) {
 navHighlightElement.classList.remove(NAV_TARGET_HIGHLIGHT_CLASS);
 navHighlightElement = null;
 }

 document.querySelectorAll(`.${NAV_TARGET_HIGHLIGHT_CLASS}`).forEach((element) => {
 element.classList.remove(NAV_TARGET_HIGHLIGHT_CLASS);
 });
}

function highlightNavTarget(targetId) {
 const element = getNavHighlightTarget(targetId);
 if (!element) return;

 clearNavTargetHighlight();
 element.classList.add(NAV_TARGET_HIGHLIGHT_CLASS);
 navHighlightElement = element;

 const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const computed = window.getComputedStyle(element);
 const baseBorderColor = computed.borderColor;
 const baseBoxShadow = computed.boxShadow === 'none' ? '0 18px 52px rgba(0,0,0,.42)' : computed.boxShadow;
 const baseFilter = computed.filter === 'none' ? 'brightness(1)' : computed.filter;

 if (reduceMotion || typeof element.animate !== 'function') {
 element.style.borderColor = '#ffe47f';
 element.style.boxShadow = `${baseBoxShadow}, 0 0 0 2px rgba(255,226,117,.60), 0 0 36px rgba(255,215,76,.58)`;

 window.setTimeout(() => {
 element.style.removeProperty('border-color');
 element.style.removeProperty('box-shadow');
 element.classList.remove(NAV_TARGET_HIGHLIGHT_CLASS);
 if (navHighlightElement === element) navHighlightElement = null;
 }, NAV_TARGET_HIGHLIGHT_MS);
 return;
 }

 navHighlightAnimation = element.animate([
 { borderColor:baseBorderColor, boxShadow:baseBoxShadow, filter:baseFilter, offset:0 },
 {
 borderColor:'#ffe47f',
 boxShadow:`${baseBoxShadow}, 0 0 0 2px rgba(255,226,117,.58), 0 0 30px rgba(255,215,76,.62), 0 0 78px rgba(255,196,37,.34)`,
 filter:'brightness(1.10)',
 offset:.22
 },
 {
 borderColor:'#ffd75a',
 boxShadow:`${baseBoxShadow}, 0 0 0 2px rgba(255,229,132,.70), 0 0 38px rgba(255,213,68,.72), 0 0 92px rgba(255,188,25,.40)`,
 filter:'brightness(1.12)',
 offset:.58
 },
 { borderColor:baseBorderColor, boxShadow:baseBoxShadow, filter:baseFilter, offset:1 }
 ], {
 duration:NAV_TARGET_HIGHLIGHT_MS,
 easing:'cubic-bezier(.22,.8,.24,1)'
 });

 navHighlightAnimation.addEventListener('finish', () => {
 element.classList.remove(NAV_TARGET_HIGHLIGHT_CLASS);
 if (navHighlightElement === element) navHighlightElement = null;
 navHighlightAnimation = null;
 }, { once:true });
}

function waitForScrollThenHighlight(targetId, expectedTop) {
 if (navScrollAnimationFrame) cancelAnimationFrame(navScrollAnimationFrame);

 const startedAt = performance.now();
 let previousY = window.pageYOffset;
 let stableFrames = 0;

 function checkPosition(now) {
 const currentY = window.pageYOffset;
 const movement = Math.abs(currentY - previousY);
 const distance = Math.abs(currentY - expectedTop);

 if (movement < .6 || distance < 2) stableFrames += 1;
 else stableFrames = 0;
 previousY = currentY;

 if ((distance < 3 && stableFrames >= 3) || now - startedAt > 1600) {
 navScrollAnimationFrame = null;
 highlightNavTarget(targetId);
 return;
 }

 navScrollAnimationFrame = requestAnimationFrame(checkPosition);
 }

 navScrollAnimationFrame = requestAnimationFrame(checkPosition);
}

function calculateSectionScrollTop(targetId, target) {
 if (targetId === '#top') return 0;

 const header = document.querySelector('.site-header');
 const headerHeight = header ? header.getBoundingClientRect().height : 0;
 const headerTop = 16;
 const gapBelowHeader = 18;
 const bottomGap = 18;
 const viewportContentTop = headerTop + headerHeight + gapBelowHeader;
 const availableHeight = Math.max(280, window.innerHeight - viewportContentTop - bottomGap);
 const rect = target.getBoundingClientRect();
 const targetDocumentTop = rect.top + window.pageYOffset;
 const targetHeight = rect.height;

 /* Se entra nello schermo, lo centra: si vede immediatamente tutto il quadrato.
 Se non entra (tipicamente su mobile), lo allinea all'inizio e lascia lo scroll normale. */
 const centeringOffset = targetHeight <= availableHeight
 ? Math.max((availableHeight - targetHeight) / 2, 0)
 : 0;

 const requestedTop = Math.max(targetDocumentTop - viewportContentTop - centeringOffset, 0);
 const maxScrollTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
 return Math.min(requestedTop, maxScrollTop);
}

function scrollToSectionView(targetId, highlightAfterScroll = true) {
 const target = document.querySelector(targetId);
 if (!target) return;

 /* Tornando alla sezione quotazioni, mantieni il calcolatore già aperto per mostrare subito il risultato. */
 if (targetId === '#quotazione' && calculatorToggle && calculatorPanel) {
  const calculatorWasClosed = calculatorPanel.classList.contains('is-collapsed');
  if (calculatorWasClosed) {
   animateCalculatorVisibility(true);
   updateCalculatorToggleState(true, true);
   aggiornaConversione();
  } else {
   calculatorPanel.setAttribute('aria-hidden', 'false');
   updateCalculatorToggleState(true, false);
  }
 }

 /* Elimina qualunque residuo della vecchia funzione di auto-zoom. */
 document.querySelectorAll('.nav-auto-fit-target').forEach((element) => {
 element.classList.remove('nav-auto-fit-target');
 element.style.removeProperty('zoom');
 element.style.removeProperty('--nav-auto-fit-zoom');
 });

 requestAnimationFrame(() => {
 const targetTop = calculateSectionScrollTop(targetId, target);
 const distance = Math.abs(window.pageYOffset - targetTop);
 window.scrollTo({ top:targetTop, behavior:'smooth' });

 if (!highlightAfterScroll) return;
 if (distance < 4) {
 window.setTimeout(() => highlightNavTarget(targetId), 90);
 } else {
 waitForScrollThenHighlight(targetId, targetTop);
 }
 });
}

document.querySelectorAll('.nav-links a[href^="#"]').forEach((link) => {
 link.addEventListener('click', (event) => {
 const targetId = link.getAttribute('href');
 if (!targetId) return;
 event.preventDefault();

 document.querySelectorAll('.nav-links a').forEach((navLink) => navLink.classList.remove('active'));
 link.classList.add('active');

 if (history.replaceState) history.replaceState(null, '', targetId);
 else window.location.hash = targetId;

 scrollToSectionView(targetId, true);
 });
});

window.addEventListener('load', () => {
 if (window.location.hash && document.querySelector(window.location.hash)) {
 setTimeout(() => scrollToSectionView(window.location.hash, true), 50);
 }
});


/* Menu mobile V68 */
(function setupMobileNavigation(){
 const header = document.querySelector('.site-header');
 const toggle = document.querySelector('.mobile-menu-toggle');
 const nav = document.getElementById('primary-navigation');
 if (!header || !toggle || !nav) return;

 const mobileQuery = window.matchMedia('(max-width:700px)');

 function setMenu(open){
  const shouldOpen = Boolean(open && mobileQuery.matches);
  header.classList.toggle('menu-open', shouldOpen);
  toggle.setAttribute('aria-expanded', String(shouldOpen));
  toggle.setAttribute('aria-label', shouldOpen ? 'Chiudi il menu' : 'Apri il menu');
 }

 toggle.addEventListener('click', (event) => {
  event.stopPropagation();
  setMenu(!header.classList.contains('menu-open'));
 });

 nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
 });

 document.addEventListener('click', (event) => {
  if (header.classList.contains('menu-open') && !header.contains(event.target)) setMenu(false);
 });

 document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
   setMenu(false);
   toggle.focus();
  }
 });

 const handleViewportChange = () => setMenu(false);
 if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', handleViewportChange);
 else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(handleViewportChange);
})();

/* Consenso analytics: Google Analytics viene caricato solo dopo un consenso esplicito. */
(function setupPrivacyConsent() {
 const banner = document.getElementById('cookie-banner');
 const acceptButton = document.getElementById('cookie-accept');
 const rejectButton = document.getElementById('cookie-reject');
 const manageButton = document.getElementById('cookie-manage');
 const consentKey = 'emerald-analytics-consent-v1';

 function updateGoogleConsent(value) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
   ad_storage: value,
   ad_user_data: value,
   ad_personalization: value,
   analytics_storage: value
  });
 }

 function loadAnalytics() {
  if (document.querySelector('script[data-emerald-analytics]')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
   ad_storage: 'denied',
   ad_user_data: 'denied',
   ad_personalization: 'denied',
   analytics_storage: 'granted'
  });
  window.gtag('js', new Date());
  window.gtag('config', 'G-0PJNESSBXS', { anonymize_ip: true, allow_google_signals: false });
  const script = document.createElement('script');
  script.async = true;
  script.dataset.emeraldAnalytics = 'true';
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-0PJNESSBXS';
  document.head.appendChild(script);
 }

 function saveConsent(value) {
  const analyticsWasLoaded = Boolean(document.querySelector('script[data-emerald-analytics]'));
  try { localStorage.setItem(consentKey, value); } catch (error) {}
  if (banner) banner.hidden = true;
  if (value === 'accepted') {
   loadAnalytics();
   updateGoogleConsent('granted');
  } else {
   updateGoogleConsent('denied');
   ['_ga', '_gid', '_gat', '_ga_0PJNESSBXS'].forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
   });
   if (analyticsWasLoaded) window.location.reload();
  }
 }

 let consent = null;
 try { consent = localStorage.getItem(consentKey); } catch (error) {}
 if (consent === 'accepted') loadAnalytics();
 else if (!consent && banner) banner.hidden = false;

 if (acceptButton) acceptButton.addEventListener('click', () => saveConsent('accepted'));
 if (rejectButton) rejectButton.addEventListener('click', () => saveConsent('rejected'));
 if (manageButton && banner) manageButton.addEventListener('click', () => {
  banner.hidden = false;
  rejectButton?.focus();
 });
})();

/* Google Maps viene richiesto solo dopo un gesto esplicito dell'utente. */
(function setupMapConsent() {
 const container = document.getElementById('map-container');
 const button = document.getElementById('map-load');
 if (!container || !button) return;
 button.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.title = 'Mappa di Emerald Gioielli a Mascali';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.src = 'https://www.google.com/maps?q=Via+Siculo+Orientale+276+95016+Mascali+CT+Italia&output=embed';
  container.replaceChildren(frame);
 });
})();

/* Mantiene evidente la sezione corrente anche durante lo scorrimento manuale. */
(function setupActiveNavigation() {
 if (!('IntersectionObserver' in window)) return;
 const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
 const targets = links
  .map(link => ({ link, target: document.querySelector(link.getAttribute('href')) }))
  .filter(item => item.target);
 if (!targets.length) return;

 const observer = new IntersectionObserver((entries) => {
  const visible = entries
   .filter(entry => entry.isIntersecting)
   .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  links.forEach((link) => {
   link.classList.remove('active');
   link.removeAttribute('aria-current');
  });
  const item = targets.find(candidate => candidate.target === visible.target);
  if (item) {
   item.link.classList.add('active');
   item.link.setAttribute('aria-current', 'page');
  }
 }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.05, 0.25, 0.6] });

 targets.forEach(item => observer.observe(item.target));
})();
