/* Sfondo animato oro/smeraldo: canvas, particelle, onde e reazione al mouse */
const canvas = document.getElementById('luxury-bg');
const ctx = canvas.getContext('2d');
const glow = document.querySelector('.animated-glow');
let w, h, dpr;
let mouse = { x: 0.5, y: 0.35, active: false };
let particles = [];
let cursorStars = [];

const isLowPowerDevice =
 (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
 (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
 window.innerWidth <= 768;

if (isLowPowerDevice) {
 document.body.classList.add('lite-mode');
}

function resizeCanvas() {
 dpr = Math.min(window.devicePixelRatio || 1, 2);
 w = canvas.width = Math.floor(innerWidth * dpr);
 h = canvas.height = Math.floor(innerHeight * dpr);
 canvas.style.width = innerWidth + 'px';
 canvas.style.height = innerHeight + 'px';
 createParticles();
}

function createParticles() {
 const count = isLowPowerDevice
 ? Math.min(40, Math.floor(innerWidth / 25))
 : Math.min(150, Math.floor(innerWidth / 9));

 particles = Array.from({ length: count }, () => ({
 x: Math.random() * w,
 y: Math.random() * h,
 r: (Math.random() * 2.2 + 0.6) * dpr,
 s: (Math.random() * 0.55 + 0.18) * dpr,
 a: Math.random() * Math.PI * 2,
 gold: Math.random() > 0.38
 }));
}

function drawWave(time, yBase, amp, color, width, speed, offset) {
 ctx.beginPath();
 for (let x = -60 * dpr; x <= w + 60 * dpr; x += 8 * dpr) {
 const nx = x / w;
 const mousePull = (mouse.y - 0.5) * 90 * dpr;
 const y = yBase + Math.sin(nx * 10 + time * speed + offset) * amp + Math.sin(nx * 23 - time * speed * 0.8) * amp * 0.35 + mousePull;
 if (x === -60 * dpr) ctx.moveTo(x, y);
 else ctx.lineTo(x, y);
 }
 ctx.strokeStyle = color;
 ctx.lineWidth = width;
 ctx.shadowBlur = 18 * dpr;
 ctx.shadowColor = color;
 ctx.stroke();
 ctx.shadowBlur = 0;
}

function animate(t) {
 const time = t * 0.001;
 ctx.clearRect(0, 0, w, h);

 const bg = ctx.createRadialGradient(w * mouse.x, h * mouse.y, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.85);
 bg.addColorStop(0, 'rgba(3, 70, 48, 0.88)');
 bg.addColorStop(0.45, 'rgba(1, 20, 14, 0.94)');
 bg.addColorStop(1, 'rgba(0, 0, 0, 1)');
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, w, h);

 drawWave(time, h * 0.26, 58 * dpr, 'rgba(0,255,170,0.34)', 2.2 * dpr, 0.55, 0);
 drawWave(time, h * 0.33, 44 * dpr, 'rgba(255,209,74,0.38)', 1.7 * dpr, 0.72, 2.4);
 drawWave(time, h * 0.66, 62 * dpr, 'rgba(0,190,120,0.28)', 2.4 * dpr, 0.48, 4.2);
 drawWave(time, h * 0.72, 36 * dpr, 'rgba(255,190,50,0.32)', 1.5 * dpr, 0.92, 5.6);

 for (const p of particles) {
 p.a += 0.01;
 p.y -= p.s;
 p.x += Math.sin(p.a) * 0.45 * dpr + (mouse.x - 0.5) * 0.55 * dpr;
 if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
 if (p.x < -10) p.x = w + 10;
 if (p.x > w + 10) p.x = -10;

 const color = p.gold ? '255,210,82' : '0,255,170';
 ctx.beginPath();
 ctx.fillStyle = `rgba(${color},${p.gold ? 0.72 : 0.48})`;
 ctx.shadowBlur = (p.gold ? 14 : 10) * dpr;
 ctx.shadowColor = `rgba(${color},0.8)`;
 ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
 ctx.fill();
 }
 ctx.shadowBlur = 0;

 for (let i = 0; i < 18; i++) {
 const x = ((i * 997) % 1000) / 1000 * w;
 const y = ((i * 571) % 1000) / 1000 * h;
 const alpha = 0.12 + (Math.sin(time * 1.35 + i * 1.7) + 1) * 0.16;
 const size = (5 + (i % 4) * 2) * dpr;
 ctx.fillStyle = `rgba(255,215,90,${alpha})`;
 ctx.shadowBlur = 18 * dpr;
 ctx.shadowColor = 'rgba(255,215,90,0.65)';
 ctx.fillRect(x - size, y, size * 2, 1 * dpr);
 ctx.fillRect(x, y - size, 1 * dpr, size * 2);
 }
 ctx.shadowBlur = 0;

 for (let i = cursorStars.length - 1; i >= 0; i--) {
 const st = cursorStars[i];
 st.life -= 0.018;
 st.x += st.vx;
 st.y += st.vy;
 st.vy += 0.006 * dpr;
 if (st.life <= 0) {
 cursorStars.splice(i, 1);
 continue;
 }
 const alpha = Math.max(0, st.life);
 const size = st.size * alpha;
 const color = st.gold ? '255,215,90' : '0,255,170';
 ctx.fillStyle = `rgba(${color},${alpha})`;
 ctx.shadowBlur = 16 * dpr * alpha;
 ctx.shadowColor = `rgba(${color},${alpha})`;
 ctx.fillRect(st.x - size, st.y, size * 2, 1.2 * dpr);
 ctx.fillRect(st.x, st.y - size, 1.2 * dpr, size * 2);
 ctx.beginPath();
 ctx.arc(st.x, st.y, Math.max(0.7 * dpr, size * 0.24), 0, Math.PI * 2);
 ctx.fill();
 }
 ctx.shadowBlur = 0;

 requestAnimationFrame(animate);
}

addEventListener('resize', resizeCanvas);
document.addEventListener('mousemove', (e) => {
 if (isLowPowerDevice) return;
 mouse.x += (e.clientX / innerWidth - mouse.x) * 0.18;
 mouse.y += (e.clientY / innerHeight - mouse.y) * 0.18;
 glow.style.setProperty('--mx', `${e.clientX}px`);
 glow.style.setProperty('--my', `${e.clientY}px`);

 for (let i = 0; i < 3; i++) {
 cursorStars.push({
 x: e.clientX * dpr + (Math.random() - 0.5) * 18 * dpr,
 y: e.clientY * dpr + (Math.random() - 0.5) * 18 * dpr,
 vx: (Math.random() - 0.5) * 1.4 * dpr,
 vy: (Math.random() - 0.5) * 1.4 * dpr,
 size: (Math.random() * 5 + 3) * dpr,
 life: 1,
 gold: Math.random() > 0.35
 });
 }
 if (cursorStars.length > 120) cursorStars.splice(0, cursorStars.length - 120);
});
resizeCanvas();
if (!isLowPowerDevice) requestAnimationFrame(animate);
else canvas.style.display = 'none';

/* Quotazioni oro e argento + selezione materiale nel calcolatore V60 */
const TROY_OUNCE_GRAMS = 31.1035;
const PUREZZA_18K = 18 / 24;
const COEFFICIENTE_BASE_ARGENTO = 0.770;
const SOGLIA_PROMO_GRAMMI = 30;

// Regole commerciali oro 18K:
// - da 30 g: valore 24K × 0,750, con riduzione del 10,5%;
// - sotto 30 g: stesso prezzo meno 3,00 €/g.
const RIDUZIONE_ACQUISTO_PROMO_18K = 0.105;
const DIFFERENZA_SOTTO_SOGLIA_18K = 3;
const RIDUZIONE_ACQUISTO_ARGENTO = 0.23;

const ARROTONDAMENTO_PREZZI_18K = 0.1;
const ARROTONDAMENTO_ARGENTO_800 = 0.01;
const INTERVALLO_AGGIORNAMENTO_MS = 60000;
const CACHE_KEY_PREZZI = 'emerald-metals-live-prices-v5';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const priceGold18Element = document.getElementById('price-gold18');
const priceGold24Element = document.getElementById('price-gold24');
const priceSilver800Element = document.getElementById('price-silver800');
const updatedElement = document.getElementById('metals-updated');
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

async function caricaCambioUsdEur() {
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
 console.warn('Provider cambio non disponibile:', error);
 }
 }
 throw new Error('Cambio USD/EUR non disponibile');
}

async function caricaPrezzoMetalloUsdOncia(symbol) {
 const data = await fetchJsonWithTimeout(`https://api.gold-api.com/price/${symbol}`);
 const price = Number(data && data.price);
 if (!Number.isFinite(price) || price <= 0) throw new Error(`Prezzo ${symbol} non disponibile`);
 return price;
}

function arrotondaAlPasso(value, step) {
 return Math.round(value / step) * step;
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

function calcolaPrezziDaMercato(prezzo24EurGrammo, prezzoArgentoPuroEurGrammo) {
 const valoreTeorico18 = prezzo24EurGrammo * PUREZZA_18K;
 const promo18 = arrotondaAlPasso(
 valoreTeorico18 * (1 - RIDUZIONE_ACQUISTO_PROMO_18K),
 ARROTONDAMENTO_PREZZI_18K
 );
 const standard18 = arrotondaAlPasso(
 promo18 - DIFFERENZA_SOTTO_SOGLIA_18K,
 ARROTONDAMENTO_PREZZI_18K
 );
 const argento800 = arrotondaAlPasso(
 prezzoArgentoPuroEurGrammo * COEFFICIENTE_BASE_ARGENTO * (1 - RIDUZIONE_ACQUISTO_ARGENTO),
 ARROTONDAMENTO_ARGENTO_800
 );
 return { standard18, promo18, argento800 };
}

function salvaPrezziInCache() {
 if (![prezzoOroPuroEurGrammo, prezzoStandard18EurGrammo, prezzoPromo18EurGrammo, prezzoArgento800EurGrammo].every(Number.isFinite)) return;
 try {
 localStorage.setItem(CACHE_KEY_PREZZI, JSON.stringify({
 timestamp: Date.now(),
 prezzo24: prezzoOroPuroEurGrammo,
 standard18: prezzoStandard18EurGrammo,
 promo18: prezzoPromo18EurGrammo,
 argento800: prezzoArgento800EurGrammo
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
 const isFresh = cached && Number.isFinite(cached.timestamp) && (Date.now() - cached.timestamp) <= CACHE_MAX_AGE_MS;
 const valuesValid = cached && [cached.prezzo24, cached.standard18, cached.promo18, cached.argento800].every(Number.isFinite);
 if (!isFresh || !valuesValid) return false;
 prezzoOroPuroEurGrammo = cached.prezzo24;
 prezzoStandard18EurGrammo = cached.standard18;
 prezzoPromo18EurGrammo = cached.promo18;
 prezzoArgento800EurGrammo = cached.argento800;
 ultimoAggiornamentoPrezzo = new Date(cached.timestamp);
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
 ? ultimoAggiornamentoPrezzo.toLocaleTimeString('it-IT')
 : '--:--:--';
 }
 if (liveTextElement) liveTextElement.textContent = usingCachedPrices ? 'ULTIMO DATO' : 'LIVE';
 if (liveBadgeElement) liveBadgeElement.classList.toggle('cached', usingCachedPrices);
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

async function aggiornaPrezziLive() {
 try {
 const [cambioUsdEur, prezzoOroUsdOncia, prezzoArgentoUsdOncia] = await Promise.all([
 caricaCambioUsdEur(),
 caricaPrezzoMetalloUsdOncia('XAU'),
 caricaPrezzoMetalloUsdOncia('XAG')
 ]);
 const nuovoPrezzo24 = prezzoOroUsdOncia * cambioUsdEur / TROY_OUNCE_GRAMS;
 const nuovoPrezzoArgentoPuro = prezzoArgentoUsdOncia * cambioUsdEur / TROY_OUNCE_GRAMS;
 if (![nuovoPrezzo24, nuovoPrezzoArgentoPuro].every(value => Number.isFinite(value) && value > 0)) {
 throw new Error('Dati di mercato non validi');
 }
 const prezzi = calcolaPrezziDaMercato(nuovoPrezzo24, nuovoPrezzoArgentoPuro);
 prezzoOroPuroEurGrammo = nuovoPrezzo24;
 prezzoStandard18EurGrammo = prezzi.standard18;
 prezzoPromo18EurGrammo = prezzi.promo18;
 prezzoArgento800EurGrammo = prezzi.argento800;
 ultimoAggiornamentoPrezzo = new Date();
 usingCachedPrices = false;
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
}

goldKaratButtons.forEach((button) => {
 button.addEventListener('click', () => setGoldView(button.dataset.asset));
});

calculatorAssetButtons.forEach((button) => {
 button.addEventListener('click', () => setCurrentAsset(button.dataset.calculatorAsset));
});

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
setInterval(aggiornaPrezziLive, INTERVALLO_AGGIORNAMENTO_MS);


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
 if (targetId === '#top') return document.querySelector('.site-header');
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
