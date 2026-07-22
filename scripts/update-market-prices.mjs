import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const API_BASE = 'https://api.thetickbase.com/v1';
const OUTPUT_FILE = new URL('../data/market-prices.json', import.meta.url);
const apiKey = String(process.env.TICKBASE_API_KEY || '').trim();

function isValidKey(key) {
  return key.startsWith('tb_live_') || key.startsWith('tb_test_');
}

async function requestJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'EmeraldGioielli-GitHubActions/1.0'
    },
    signal: AbortSignal.timeout(15000)
  });

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`TickBase ha restituito una risposta non JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`TickBase: ${message}`);
  }
  return data;
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} non disponibile.`);
  }
  return number;
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function oldestTimestamp(values) {
  const valid = values
    .map(normalizeTimestamp)
    .filter(Boolean)
    .map(value => new Date(value));
  if (!valid.length) return new Date().toISOString();
  valid.sort((a, b) => a.getTime() - b.getTime());
  return valid[0].toISOString();
}

async function existingValidPayload() {
  try {
    const raw = await readFile(OUTPUT_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data?.success === true && Number(data.xau_eur_per_ounce) > 0 && Number(data.xag_eur_per_ounce) > 0) {
      return data;
    }
  } catch {
    // Nessun dato precedente valido.
  }
  return null;
}

async function main() {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });

  if (!isValidKey(apiKey)) {
    console.warn('TICKBASE_API_KEY non configurata: mantengo il file dati esistente.');
    return;
  }

  try {
    const [fx, gold, silver] = await Promise.all([
      requestJson('/fx/latest?symbols=EUR'),
      requestJson('/metals/latest?metal=XAU'),
      requestJson('/metals/latest?metal=XAG')
    ]);

    const usdEur = positiveNumber(fx?.rates?.EUR, 'Cambio USD/EUR');
    const goldUsd = positiveNumber(gold?.bid ?? gold?.price, 'Prezzo oro');
    const silverUsd = positiveNumber(silver?.bid ?? silver?.price, 'Prezzo argento');
    const generatedAt = new Date().toISOString();

    const payload = {
      success: true,
      provider: 'TickBase',
      price_mode: gold?.bid != null && silver?.bid != null ? 'bid' : 'spot',
      xau_eur_per_ounce: goldUsd * usdEur,
      xag_eur_per_ounce: silverUsd * usdEur,
      xau_usd_per_ounce: goldUsd,
      xag_usd_per_ounce: silverUsd,
      usd_eur: usdEur,
      as_of: oldestTimestamp([fx?.as_of, gold?.as_of, silver?.as_of]),
      source_timestamps: {
        fx: normalizeTimestamp(fx?.as_of),
        xau: normalizeTimestamp(gold?.as_of),
        xag: normalizeTimestamp(silver?.as_of)
      },
      generated_at: generatedAt,
      stale: false
    };

    await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Quotazioni TickBase aggiornate: ${payload.as_of}`);
  } catch (error) {
    const previous = await existingValidPayload();
    if (previous) {
      previous.stale = true;
      previous.update_error = error instanceof Error ? error.message : String(error);
      previous.last_attempt_at = new Date().toISOString();
      await writeFile(OUTPUT_FILE, `${JSON.stringify(previous, null, 2)}\n`, 'utf8');
      console.warn(`Aggiornamento non riuscito; mantengo l'ultimo dato valido: ${previous.update_error}`);
      return;
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
