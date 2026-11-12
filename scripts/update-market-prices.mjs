import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { validateFx, publicUsdEur, loadMarketData } from '../market-data.mjs';
import { createQuoteSnapshot } from '../quote-snapshot.mjs';

const TICKBASE_API_BASE = 'https://api.thetickbase.com/v1';
const OUTPUT_FILE = new URL('../data/market-prices.json', import.meta.url);
const apiKey = String(process.env.TICKBASE_API_KEY || '').trim();

function isValidKey(key) {
 return key.startsWith('tb_live_') || key.startsWith('tb_test_');
}

async function requestJson(url, options = {}) {
 const response = await fetch(url, {
  ...options,
  signal: AbortSignal.timeout(options.timeoutMs || 15000)
 });
 const body = await response.text();
 let data;
 try {
  data = JSON.parse(body);
 } catch {
  throw new Error(`Risposta non JSON (HTTP ${response.status}).`);
 }
 if (!response.ok) {
  const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
  throw new Error(message);
 }
 return data;
}

async function getTickBaseUsdEur() {
 if (!isValidKey(apiKey)) throw new Error('TICKBASE_API_KEY non configurata.');
 const data = await requestJson(`${TICKBASE_API_BASE}/fx/latest?symbols=EUR`, {
  headers: {
   Authorization: `Bearer ${apiKey}`,
   Accept: 'application/json',
   'User-Agent': 'EmeraldGioielli-GitHubActions/2.0'
  }
 });
 return validateFx({ value: data?.rates?.EUR, asOf: data?.as_of, source: 'TickBase FX' });
}

async function getUsdEur() {
 try {
  return await getTickBaseUsdEur();
 } catch (error) {
  console.warn(`TickBase non disponibile: ${error instanceof Error ? error.message : error}`);
  return await publicUsdEur(requestJson);
 }
}

async function main() {
 const fx = await getUsdEur();
 const payload = {
  success: true,
  provider: fx.source,
  usd_eur: fx.value,
  as_of: fx.asOf,
  generated_at: new Date().toISOString(),
  stale: false
 };
 // Riusa gli stessi controlli e la stessa conversione del browser, senza richieste FX duplicate.
 const market = await loadMarketData(url => url.startsWith('data/') ? Promise.resolve(payload) : requestJson(url));
 const snapshot = createQuoteSnapshot(market);
 await mkdir(new URL('../data/', import.meta.url), { recursive: true });
 await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
 await writeFile(new URL('../data/metal-prices.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
 console.log(`Cambio e metalli aggiornati: ${fx.value} EUR per USD - ${market.provider}`);
}

main().catch((error) => {
 console.error(`Aggiornamento quotazioni fallito: ${error instanceof Error ? error.message : error}`);
 process.exitCode = 1;
});
