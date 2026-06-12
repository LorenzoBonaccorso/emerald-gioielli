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

/* Quotazione oro + conversione grammi/euro */
// Logica automatica 18K:
// - il prezzo non viene inserito a mano;
// - il sito legge il prezzo dell’oro 24K live, lo converte in €/g e calcola il 18K;
// - standard e promo derivano da percentuali commerciali, non da prezzi fissi;
// - sotto i 30 g si applica la percentuale standard, da 30 g in su quella promo.
const TROY_OUNCE_GRAMS = 31.1035;
const PUREZZA_18K = 18 / 24;
const SOGLIA_PROMO_GRAMMI = 30;

// Parametri commerciali: NON sono prezzi manuali.
// Indicano quale quota del valore teorico 18K riconoscere al cliente.
// Quando il mercato si muove, i valori standard e promo si adeguano automaticamente.
// Coefficienti tarati per restare vicini a 74,5 €/g standard e 78 €/g promo con il mercato attuale.
const PERCENTUALE_ACQUISTO_STANDARD_18K = 0.845;
const PERCENTUALE_ACQUISTO_PROMO_18K = 0.885;

const ARROTONDAMENTO_PREZZI_18K = 0.5;
const INTERVALLO_AGGIORNAMENTO_MS = 60000;
const CACHE_KEY_PREZZI = 'emerald-gold-live-prices-v1';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const priceElement = document.getElementById('gold-price');
const updatedElement = document.getElementById('gold-updated');
const gramsInput = document.getElementById('gold-grams');
const totalElement = document.getElementById('gold-total');
const karatTitleElement = document.getElementById('gold-karat-title');
const goldLabelElement = document.getElementById('gold-label');
const karatButtons = document.querySelectorAll('.karat-option');
const converterNote = document.querySelector('.converter-note');
const minimumOfferElement = document.getElementById('minimum-offer');
const minimumOfferTitle = minimumOfferElement ? minimumOfferElement.querySelector('strong') : null;
const minimumOfferText = minimumOfferElement ? minimumOfferElement.querySelector('span') : null;

let prezzoStandard18EurGrammo = null;
let prezzoPromo18EurGrammo = null;
let prezzoOroPuroEurGrammo = null;
let ultimoAggiornamentoPrezzo = null;
let currentKarat = '18';

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

async function caricaPrezzoOroUsdOncia() {
  const data = await fetchJsonWithTimeout('https://api.gold-api.com/price/XAU');
  const price = Number(data && data.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Prezzo oro non disponibile');
  }

  return price;
}

function arrotondaAlPasso(value, step) {
  return Math.round(value / step) * step;
}

function formatEuroPrezzo18(value) {
  if (!Number.isFinite(value)) return 'N/D';

  const isInteger = Math.abs(value - Math.round(value)) < 0.001;
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: isInteger ? 0 : 1,
    maximumFractionDigits: 1
  });
}

function formatEuroUnaCifra(value) {
  if (!Number.isFinite(value)) return 'N/D';
  return value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatEuroDueCifre(value) {
  if (!Number.isFinite(value)) return 'N/D';
  return value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getGrammiInseriti() {
  if (!gramsInput) return 0;
  return Number(String(gramsInput.value).replace(',', '.')) || 0;
}

function isPromoApplicabile(grammi) {
  return grammi >= SOGLIA_PROMO_GRAMMI;
}

function getPrezzo18PerGrammi(grammi) {
  return isPromoApplicabile(grammi) ? prezzoPromo18EurGrammo : prezzoStandard18EurGrammo;
}

function getPrezzoMostrato(grammi = null) {
  if (currentKarat === '24') return prezzoOroPuroEurGrammo;

  // Nel box principale evidenziamo sempre il prezzo promo per almeno 30 grammi.
  if (grammi === null) return prezzoPromo18EurGrammo;

  // Nel calcolatore applichiamo la regola sui grammi inseriti.
  return getPrezzo18PerGrammi(grammi);
}

function calcolaPrezzi18DaMercato(prezzo24EurGrammo) {
  const valoreTeorico18 = prezzo24EurGrammo * PUREZZA_18K;

  const standard = arrotondaAlPasso(
    valoreTeorico18 * PERCENTUALE_ACQUISTO_STANDARD_18K,
    ARROTONDAMENTO_PREZZI_18K
  );

  const promo = arrotondaAlPasso(
    valoreTeorico18 * PERCENTUALE_ACQUISTO_PROMO_18K,
    ARROTONDAMENTO_PREZZI_18K
  );

  return {
    standard,
    promo: Math.max(promo, standard)
  };
}

function salvaPrezziInCache() {
  if (!Number.isFinite(prezzoOroPuroEurGrammo) || !Number.isFinite(prezzoStandard18EurGrammo) || !Number.isFinite(prezzoPromo18EurGrammo)) {
    return;
  }

  try {
    localStorage.setItem(CACHE_KEY_PREZZI, JSON.stringify({
      timestamp: Date.now(),
      prezzo24: prezzoOroPuroEurGrammo,
      standard18: prezzoStandard18EurGrammo,
      promo18: prezzoPromo18EurGrammo
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

    if (!isFresh) return false;
    if (!Number.isFinite(cached.prezzo24) || !Number.isFinite(cached.standard18) || !Number.isFinite(cached.promo18)) return false;

    prezzoOroPuroEurGrammo = cached.prezzo24;
    prezzoStandard18EurGrammo = cached.standard18;
    prezzoPromo18EurGrammo = cached.promo18;
    ultimoAggiornamentoPrezzo = new Date(cached.timestamp);
    return true;
  } catch (error) {
    console.warn('Cache prezzi non leggibile:', error);
    return false;
  }
}

function aggiornaBoxOfferta() {
  if (minimumOfferTitle) {
    minimumOfferTitle.textContent = `Offerta ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi`;
  }

  if (minimumOfferText) {
    minimumOfferText.textContent = `Sotto i ${SOGLIA_PROMO_GRAMMI} grammi: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} €/g. Prezzi indicativi già comprensivi delle commissioni.`;
  }
}

function aggiornaConversione() {
  if (!gramsInput || !totalElement) return;

  const grammi = getGrammiInseriti();
  const prezzo = getPrezzoMostrato(grammi);

  if (!Number.isFinite(prezzo)) {
    totalElement.textContent = 'N/D';
    if (converterNote) converterNote.textContent = 'Quotazione temporaneamente non disponibile. Riprova tra poco o richiedi una valutazione.';
    return;
  }

  const totale = grammi * prezzo;

  totalElement.textContent = currentKarat === '18'
    ? `${formatEuroUnaCifra(totale)} €`
    : `${formatEuroDueCifre(totale)} €`;

  if (currentKarat === '18' && converterNote) {
    if (isPromoApplicabile(grammi)) {
      converterNote.textContent = `Offerta applicata: ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi.`;
    } else {
      const mancanti = Math.max(SOGLIA_PROMO_GRAMMI - grammi, 0);
      converterNote.textContent = `Prezzo standard: ${formatEuroPrezzo18(prezzoStandard18EurGrammo)} €/g. Ti mancano ${formatEuroUnaCifra(mancanti)} g per l’offerta da ${formatEuroPrezzo18(prezzoPromo18EurGrammo)} €/g.`;
    }
  }
}

function aggiornaOraVisualizzata() {
  if (!updatedElement) return;

  if (ultimoAggiornamentoPrezzo instanceof Date && !Number.isNaN(ultimoAggiornamentoPrezzo.getTime())) {
    updatedElement.textContent = ultimoAggiornamentoPrezzo.toLocaleTimeString('it-IT');
  } else {
    updatedElement.textContent = '--:--:--';
  }
}

function aggiornaVistaPrezzo() {
  const prezzo = getPrezzoMostrato();

  if (currentKarat === '24') {
    if (karatTitleElement) karatTitleElement.textContent = 'Oro 24K';
    if (goldLabelElement) goldLabelElement.textContent = 'Quotazione mercato indicativa';
    if (converterNote) converterNote.textContent = 'Calcolo indicativo basato sulla quotazione live dell’oro 24K.';
    if (minimumOfferElement) minimumOfferElement.style.display = 'none';
    if (priceElement) priceElement.textContent = formatEuroDueCifre(prezzo);
  } else {
    if (karatTitleElement) karatTitleElement.textContent = 'Oro 18K';
    if (goldLabelElement) goldLabelElement.textContent = 'Prezzo acquisto indicativo';
    if (minimumOfferElement) minimumOfferElement.style.display = '';
    aggiornaBoxOfferta();
    if (priceElement) priceElement.textContent = formatEuroPrezzo18(prezzoPromo18EurGrammo);
  }

  aggiornaOraVisualizzata();
  aggiornaConversione();
}

async function aggiornaPrezzoLive() {
  try {
    const cambioUsdEur = await caricaCambioUsdEur();
    const prezzoUsdOncia = await caricaPrezzoOroUsdOncia();
    const nuovoPrezzo24 = prezzoUsdOncia * cambioUsdEur / TROY_OUNCE_GRAMS;

    if (!Number.isFinite(nuovoPrezzo24) || nuovoPrezzo24 <= 0) throw new Error('Dato prezzo non valido');

    const prezzi18 = calcolaPrezzi18DaMercato(nuovoPrezzo24);

    prezzoOroPuroEurGrammo = nuovoPrezzo24;
    prezzoStandard18EurGrammo = prezzi18.standard;
    prezzoPromo18EurGrammo = prezzi18.promo;
    ultimoAggiornamentoPrezzo = new Date();
    salvaPrezziInCache();
  } catch (error) {
    console.warn('Aggiornamento prezzo non disponibile:', error);

    // Nessun valore commerciale manuale e nessun valore casuale:
    // se la chiamata live fallisce, usiamo solo un dato live già salvato di recente.
    if (!Number.isFinite(prezzoPromo18EurGrammo)) {
      caricaPrezziDaCache();
    }
  }

  aggiornaVistaPrezzo();
}

karatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentKarat = button.dataset.karat || '18';
    karatButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    aggiornaVistaPrezzo();
  });
});

if (gramsInput) gramsInput.addEventListener('input', aggiornaConversione);

// Prima prova a mostrare l’ultimo dato live salvato, poi aggiorna dal mercato.
caricaPrezziDaCache();
aggiornaVistaPrezzo();
aggiornaPrezzoLive();
setInterval(aggiornaPrezzoLive, INTERVALLO_AGGIORNAMENTO_MS);
