import { marketDate } from './market-data.mjs';
import { TROY_OUNCE_GRAMS, calcolaPrezziDaMercato } from './pricing.mjs';

export const MAX_SNAPSHOT_AGE_MS = 3 * 60 * 60 * 1000;

// La data di pubblicazione non sostituisce mai la data effettiva delle fonti.
export function createQuoteSnapshot(market, now = Date.now()) {
 const snapshot = {
  generated_at: new Date(now).toISOString(),
  market: { ...market, asOf: new Date(market.asOf).toISOString() }
 };
 readQuoteSnapshot(snapshot, now);
 return snapshot;
}

export function readQuoteSnapshot(snapshot, now = Date.now()) {
 const generatedAt = marketDate(snapshot?.generated_at, now);
 if (now - generatedAt.getTime() > MAX_SNAPSHOT_AGE_MS) throw new Error('Quotazione pubblicata scaduta.');
 const market = snapshot?.market;
 const asOf = marketDate(market?.asOf, now);
 if (market?.stale !== false || market?.mode !== 'spot' || typeof market?.provider !== 'string' || !market.provider.trim()) {
  throw new Error('Fonte della quotazione non valida.');
 }
 const gold24 = market.oroEurOncia / TROY_OUNCE_GRAMS;
 const silverPure = market.argentoEurOncia / TROY_OUNCE_GRAMS;
 const prices = calcolaPrezziDaMercato(gold24, silverPure);
 return { ...prices, gold24, asOf, generatedAt, provider: market.provider, mode: market.mode };
}

export function latestValidSnapshot(snapshots, now = Date.now()) {
 return snapshots.filter(snapshot => {
  try { readQuoteSnapshot(snapshot, now); return true; } catch { return false; }
 }).sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))[0] ?? null;
}
