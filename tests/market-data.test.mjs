import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketData, marketDate, validateFx, MAX_MARKET_AGE_MS } from '../market-data.mjs';
import { TROY_OUNCE_GRAMS } from '../pricing.mjs';

const now = Date.parse('2026-10-25T09:32:10Z');
const fxTime = '2026-10-25T00:02:31Z';
const staticFx = { success: true, usd_eur: 0.892628, as_of: fxTime, provider: 'TickBase FX', stale: false };

function fixture(overrides = {}) {
 const responses = {
  static: staticFx,
  XAU: { price: 3996.899902, currency: 'USD', updatedAt: '2026-10-25T09:32:09Z' },
  XAG: { price: 54.046001, currency: 'USD', updatedAt: '2026-10-25T09:32:08Z' },
  public: { rates: { EUR: 0.892628 }, time_last_update_unix: Date.parse(fxTime) / 1000 },
  frankfurter: { rates: { EUR: 0.89342 }, date: '2026-10-23' },
  ...overrides
 };
 const calls = [];
 const fetchJson = async (url) => {
  calls.push(url);
  const key = url.startsWith('data/') ? 'static' : url.includes('open.er-api') ? 'public' : url.includes('frankfurter') ? 'frankfurter' : url.split('/').at(-1);
  const data = responses[key];
  if (data instanceof Error) throw data;
  return data;
 };
 return { calls, fetchJson };
}

test('scarta il cambio del 14 agosto anche se il file è generato oggi', async () => {
 const { fetchJson, calls } = fixture({ static: { ...staticFx, usd_eur: 0.86449, as_of: '2026-08-14T23:59:56Z', generated_at: new Date(now).toISOString() } });
 const market = await loadMarketData(fetchJson, now);
 assert.equal((market.oroEurOncia / TROY_OUNCE_GRAMS).toFixed(2), '114.71');
 assert.equal(market.provider, 'Gold-API + open.er-api.com');
 assert.equal(market.asOf.toISOString(), new Date(fxTime).toISOString());
 assert.equal(calls.filter(url => url.includes('/price/')).length, 2);
});

test('usa un cambio statico recente e la sua fonte effettiva senza richieste FX extra', async () => {
 const { fetchJson, calls } = fixture({ static: { ...staticFx, provider: 'Frankfurter' } });
 const market = await loadMarketData(fetchJson, now);
 assert.equal(calls.length, 3);
 assert.equal(market.provider, 'Gold-API + Frankfurter');
});

test('passa alla seconda fonte quando la prima fonte FX è vecchia', async () => {
 const { fetchJson } = fixture({ static: new Error('offline'), public: { rates: { EUR: 0.86449 }, time_last_update_unix: Date.parse('2026-08-14') / 1000 } });
 const market = await loadMarketData(fetchJson, now);
 assert.equal(market.provider, 'Gold-API + Frankfurter');
 assert.equal(market.asOf.toISOString(), '2026-10-23T00:00:00.000Z');
});

test('non restituisce una quotazione se tutte le fonti FX sono indisponibili', async () => {
 const { fetchJson } = fixture({ static: new Error('offline'), public: new Error('offline'), frankfurter: new Error('offline') });
 await assert.rejects(loadMarketData(fetchJson, now), /recente non disponibile/);
});

test('rifiuta date mancanti, non valide, future e vecchie senza sostituirle con oggi', () => {
 for (const value of [undefined, null, '', 'invalid', now + 3600000, now - MAX_MARKET_AGE_MS - 1]) {
  assert.throws(() => marketDate(value, now));
 }
 assert.equal(marketDate(now / 1000, now).getTime(), now);
 assert.equal(marketDate(now, now).getTime(), now);
 assert.equal(marketDate('2026-10-23', now).toISOString(), '2026-10-23T00:00:00.000Z');
 assert.throws(() => validateFx({ value: 0, asOf: fxTime }, now));
});

test('rifiuta metalli privi di data o troppo vecchi e valute inattese', async () => {
 for (const XAU of [
  { price: 3996.9 },
  { price: 3996.9, updatedAt: '2026-08-14' },
  { price: 3996.9, updatedAt: fxTime, currency: 'EUR' }
 ]) {
  await assert.rejects(loadMarketData(fixture({ XAU }).fetchJson, now));
 }
});

test('un file marcato stale attiva la fonte di riserva', async () => {
 const { fetchJson } = fixture({ static: { ...staticFx, stale: true } });
 assert.equal((await loadMarketData(fetchJson, now)).provider, 'Gold-API + open.er-api.com');
});
