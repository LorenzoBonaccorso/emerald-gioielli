// Quattro giorni coprono fine settimana e festività senza accettare dati vecchi di settimane.
export const MAX_MARKET_AGE_MS = 4 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function marketDate(value, now = Date.now()) {
 if (value === null || value === undefined || value === '') throw new Error('Data di mercato assente.');
 const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
 const age = now - date.getTime();
 if (!Number.isFinite(age) || age < -MAX_FUTURE_SKEW_MS || age > MAX_MARKET_AGE_MS) {
  throw new Error('Data di mercato non valida o troppo vecchia.');
 }
 return date;
}

function positiveNumber(value) {
 const number = Number(value);
 if (!Number.isFinite(number) || number <= 0) throw new Error('Valore di mercato non valido.');
 return number;
}

export function validateFx({ value, asOf, source }, now = Date.now()) {
 return { value: positiveNumber(value), asOf: marketDate(asOf, now), source };
}

export async function publicUsdEur(fetchJson, now = Date.now()) {
 const providers = [
  async () => {
   const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
   return validateFx({ value: data?.rates?.EUR, asOf: data?.time_last_update_unix, source: 'open.er-api.com' }, now);
  },
  async () => {
   const data = await fetchJson('https://api.frankfurter.app/latest?from=USD&to=EUR');
   // La fonte indica solo il giorno: non inventiamo un orario di aggiornamento.
   return validateFx({ value: data?.rates?.EUR, asOf: data?.date, source: 'Frankfurter' }, now);
  }
 ];
 for (const provider of providers) {
  try {
   return await provider();
  } catch { /* Prova la successiva fonte indipendente. */ }
 }
 throw new Error('Cambio USD/EUR recente non disponibile.');
}

export async function loadMarketData(fetchJson, now = Date.now()) {
 const loadFx = async () => {
  try {
   const data = await fetchJson(`data/market-prices.json?v=${Math.floor(now / 300000)}`, 12000);
   if (data?.success !== true || data.stale) throw new Error('Cambio statico non disponibile.');
   // Conta la data del cambio, non generated_at (che indica solo la creazione del file).
   return validateFx({ value: data.usd_eur, asOf: data.as_of, source: data.provider || 'Cambio pubblicato' }, now);
  } catch {
   return publicUsdEur(fetchJson, now);
  }
 };
 const loadMetal = async (symbol) => {
  const data = await fetchJson(`https://api.gold-api.com/price/${symbol}`);
  if (data.currency && data.currency !== 'USD') throw new Error('Valuta del metallo inattesa.');
  return {
   value: positiveNumber(data.price),
   asOf: marketDate(data.timestamp ?? data.updatedAt ?? data.date ?? data.time, now)
  };
 };
 const [fx, gold, silver] = await Promise.all([loadFx(), loadMetal('XAU'), loadMetal('XAG')]);
 return {
  oroEurOncia: gold.value * fx.value,
  argentoEurOncia: silver.value * fx.value,
  asOf: new Date(Math.min(gold.asOf.getTime(), silver.asOf.getTime(), fx.asOf.getTime())),
  stale: false,
  provider: `Gold-API + ${fx.source}`,
  mode: 'spot'
 };
}
