const TROY_OUNCE_GRAMS = 31.1035;
const COEFFICIENTE_ACQUISTO_18K = 0.655;
const SCONTO_FISSO_ACQUISTO_18K = 0;

const priceElement = document.getElementById('lastPrice');
const updatedElement = document.getElementById('lastUpdate');
const gramsInput = document.getElementById('gold-grams');
const totalElement = document.getElementById('gold-total');
const statusElement = document.getElementById('liveStatus');
let prezzoAcquisto18EurGrammo = null;

async function caricaCambio() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!response.ok) throw new Error('Cambio non disponibile');
  const data = await response.json();
  return Number(data.rates.EUR);
}

async function caricaPrezzoOro() {
  const response = await fetch('https://api.gold-api.com/price/XAU');
  if (!response.ok) throw new Error('Prezzo oro non disponibile');
  const data = await response.json();
  return Number(data.price);
}

function calcolaPrezzoAcquisto18(prezzoOroPuroEurGrammo) {
  return Math.max(0, prezzoOroPuroEurGrammo * COEFFICIENTE_ACQUISTO_18K - SCONTO_FISSO_ACQUISTO_18K);
}

function fallbackPrezzo() {
  return 78 + Math.sin(Date.now() / 420000) * 0.18 + (Math.random() - 0.5) * 0.04;
}

function formatEuroIntero(value) {
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function aggiornaConversione() {
  if (!gramsInput || !totalElement || prezzoAcquisto18EurGrammo === null) return;
  const grammi = Number(String(gramsInput.value).replace(',', '.')) || 0;
  totalElement.textContent = `${formatEuroIntero(grammi * prezzoAcquisto18EurGrammo)} €`;
}

async function aggiornaPrezzoLive() {
  try {
    let prezzo18;
    try {
      const cambioUsdEur = await caricaCambio();
      const prezzoUsdOncia = await caricaPrezzoOro();
      const prezzoOroPuroEurGrammo = prezzoUsdOncia * cambioUsdEur / TROY_OUNCE_GRAMS;
      prezzo18 = calcolaPrezzoAcquisto18(prezzoOroPuroEurGrammo);
      if (statusElement) statusElement.textContent = 'Prezzo acquisto indicativo aggiornato automaticamente.';
      if (statusElement) statusElement.className = 'status ok';
    } catch (error) {
      prezzo18 = fallbackPrezzo();
      if (statusElement) statusElement.textContent = 'API non disponibile: uso valore temporaneo.';
      if (statusElement) statusElement.className = 'status warn';
    }

    prezzoAcquisto18EurGrammo = prezzo18;
    priceElement.textContent = `${formatEuroIntero(prezzo18)} €`;
    updatedElement.textContent = new Date().toLocaleTimeString('it-IT');
    aggiornaConversione();
  } catch (error) {
    priceElement.textContent = 'N/D';
    updatedElement.textContent = 'Errore';
    if (statusElement) statusElement.className = 'status err';
    console.error(error);
  }
}

if (gramsInput) gramsInput.addEventListener('input', aggiornaConversione);
aggiornaPrezzoLive();
setInterval(aggiornaPrezzoLive, 60000);
