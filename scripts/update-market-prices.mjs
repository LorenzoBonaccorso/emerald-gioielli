import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

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

function positiveNumber(value, label) {
 const number = Number(value);
 if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} non disponibile.`);
 return number;
}

function normalizeTimestamp(value) {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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
 return {
  value: positiveNumber(data?.rates?.EUR, 'Cambio USD/EUR TickBase'),
  asOf: normalizeTimestamp(data?.as_of),
  source: 'TickBase FX'
 };
}

async function getPublicUsdEur() {
 const providers = [
  async () => {
   const data = await requestJson('https://open.er-api.com/v6/latest/USD');
   return {
    value: positiveNumber(data?.rates?.EUR, 'Cambio USD/EUR open.er-api.com'),
    asOf: normalizeTimestamp(Number(data?.time_last_update_unix) * 1000),
    source: 'open.er-api.com'
   };
  },
  async () => {
   const data = await requestJson('https://api.frankfurter.app/latest?from=USD&to=EUR');
   return {
    value: positiveNumber(data?.rates?.EUR, 'Cambio USD/EUR Frankfurter'),
    asOf: normalizeTimestamp(data?.date ? `${data.date}T16:00:00.000Z` : new Date()),
    source: 'Frankfurter'
   };
  }
 ];

 const errors = [];
 for (const provider of providers) {
  try {
   return await provider();
  } catch (error) {
   errors.push(error instanceof Error ? error.message : String(error));
  }
 }
 throw new Error(`Provider FX non disponibili: ${errors.join(' | ')}`);
}

async function getUsdEur() {
 try {
  return await getTickBaseUsdEur();
 } catch (error) {
  console.warn(`TickBase non disponibile: ${error instanceof Error ? error.message : error}`);
  return await getPublicUsdEur();
 }
}

async function main() {
 await mkdir(new URL('../data/', import.meta.url), { recursive: true });
 const fx = await getUsdEur();
 const payload = {
  success: true,
  provider: fx.source,
  usd_eur: fx.value,
  as_of: fx.asOf,
  generated_at: new Date().toISOString(),
  stale: false
 };
 await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
 console.log(`Cambio aggiornato: ${fx.value} EUR per USD - ${fx.source}`);
}

main().catch((error) => {
 console.error(`Aggiornamento cambio fallito: ${error instanceof Error ? error.message : error}`);
 process.exitCode = 1;
});
