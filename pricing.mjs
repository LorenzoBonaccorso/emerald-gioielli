export const TROY_OUNCE_GRAMS = 31.1034768;
export const PUREZZA_18K = 18 / 24;
export const COEFFICIENTE_BASE_ARGENTO = 0.770;
export const SOGLIA_PROMO_GRAMMI = 30;
export const RIDUZIONE_ACQUISTO_PROMO_18K = 0.105;
export const DIFFERENZA_SOTTO_SOGLIA_18K = 3;
export const RIDUZIONE_ACQUISTO_ARGENTO = 0.32;
export const ARROTONDAMENTO_PREZZI_18K = 0.1;
export const ARROTONDAMENTO_ARGENTO_800 = 0.01;

function requirePositiveNumber(value, label) {
 if (!Number.isFinite(value) || value <= 0) {
  throw new TypeError(`${label} deve essere un numero positivo.`);
 }
}

export function arrotondaAlPasso(value, step) {
 requirePositiveNumber(step, 'Il passo di arrotondamento');
 if (!Number.isFinite(value)) throw new TypeError('Il valore da arrotondare non è valido.');
 const decimals = String(step).split('.')[1]?.length || 0;
 return Number((Math.round(value / step) * step).toFixed(decimals));
}

export function calcolaPrezziDaMercato(prezzo24EurGrammo, prezzoArgentoPuroEurGrammo) {
 requirePositiveNumber(prezzo24EurGrammo, 'Il prezzo dell’oro 24K');
 requirePositiveNumber(prezzoArgentoPuroEurGrammo, 'Il prezzo dell’argento puro');

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

export function prezzoOro18PerPeso(grammi, prezzi) {
 if (!Number.isFinite(grammi) || grammi < 0) throw new TypeError('Il peso non è valido.');
 if (!prezzi || !Number.isFinite(prezzi.standard18) || !Number.isFinite(prezzi.promo18)) {
  throw new TypeError('I prezzi dell’oro 18K non sono validi.');
 }
 return grammi >= SOGLIA_PROMO_GRAMMI ? prezzi.promo18 : prezzi.standard18;
}
