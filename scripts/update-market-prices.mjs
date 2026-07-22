import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const API_BASE = 'https://api.thetickbase.com/v1';
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
    throw new Error(`Risposta non JSON da ${url} (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function requestTickBase(path) {
  return await requestJson(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'EmeraldGioielli-GitHubActions/1.1'
    }
  });
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

function extractPrice(data, label) {
  // Supporta più forme di risposta, così il workflow resta robusto se l'API cambia leggermente naming.
  return positiveNumber(
    data?.bid ?? data?.price ?? data?.mid ?? data?.value ?? data?.rate,
    label
  );
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

async function fallbackUsdEur() {
  const providers = [
    async () => {
      const data = await requestJson('https://open.er-api.com/v6/latest/USD', { timeoutMs: 15000 });
      return positiveNumber(data?.rates?.EUR, 'Cambio USD/EUR fallback');
    },
    async () => {
      const data = await requestJson('https://api.frankfurter.app/latest?from=USD&to=EUR', { timeoutMs: 15000 });
      return positiveNumber(data?.rates?.EUR, 'Cambio USD/EUR fallback');
    }
  ];

  const errors = [];
  for (const provider of providers) {
    try {
      return { value: await provider(), source: 'FX fallback' };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Cambio USD/EUR fallback non disponibile: ${errors.join(' | ')}`);
}

async function fallbackMetalUsd(symbol) {
  const data = await requestJson(`https://api.gold-api.com/price/${symbol}`, { timeoutMs: 15000 });
  return {
    value: positiveNumber(data?.price, `Prezzo ${symbol} fallback`),
    asOf: data?.timestamp || data?.updatedAt || new Date().toISOString(),
    source: `Gold-API ${symbol}`
  };
}

async function getUsdEur() {
  try {
    const fx = await requestTickBase('/fx/latest?symbols=EUR');
    return {
      value: positiveNumber(fx?.rates?.EUR, 'Cambio USD/EUR TickBase'),
      asOf: fx?.as_of,
      source: 'TickBase FX'
    };
  } catch (error) {
    console.warn(`TickBase FX non disponibile: ${error instanceof Error ? error.message : error}`);
    const fallback = await fallbackUsdEur();
    return { ...fallback, asOf: new Date().toISOString() };
  }
}

async function getMetalUsd(symbol) {
  try {
    const metal = await requestTickBase(`/metals/latest?metal=${symbol}`);
    return {
      value: extractPrice(metal, `Prezzo ${symbol} TickBase`),
      asOf: metal?.as_of,
      source: `TickBase ${symbol}`,
      mode: metal?.bid != null ? 'bid' : 'spot'
    };
  } catch (error) {
    console.warn(`TickBase ${symbol} non disponibile: ${error instanceof Error ? error.message : error}`);
    const fallback = await fallbackMetalUsd(symbol);
    return { ...fallback, mode: 'spot' };
  }
}

async function main() {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });

  if (!isValidKey(apiKey)) {
    console.warn('TICKBASE_API_KEY non configurata: provo comunque le fonti di riserva pubbliche.');
  }

  try {
    const [fx, gold, silver] = await Promise.all([
      isValidKey(apiKey) ? getUsdEur() : fallbackUsdEur(),
      isValidKey(apiKey) ? getMetalUsd('XAU') : fallbackMetalUsd('XAU'),
      isValidKey(apiKey) ? getMetalUsd('XAG') : fallbackMetalUsd('XAG')
    ]);

    const generatedAt = new Date().toISOString();
    const allSources = [fx.source, gold.source, silver.source];
    const usesTickBase = allSources.some(source => source.startsWith('TickBase'));
    const usesFallback = allSources.some(source => source.includes('fallback') || source.startsWith('Gold-API'));

    const payload = {
      success: true,
      provider: usesFallback ? 'TickBase + fonti di riserva' : 'TickBase',
      price_mode: gold.mode === 'bid' && silver.mode === 'bid' ? 'bid' : 'mixed',
      xau_eur_per_ounce: gold.value * fx.value,
      xag_eur_per_ounce: silver.value * fx.value,
      xau_usd_per_ounce: gold.value,
      xag_usd_per_ounce: silver.value,
      usd_eur: fx.value,
      as_of: oldestTimestamp([fx.asOf, gold.asOf, silver.asOf]),
      source_timestamps: {
        fx: normalizeTimestamp(fx.asOf),
        xau: normalizeTimestamp(gold.asOf),
        xag: normalizeTimestamp(silver.asOf)
      },
      source_detail: {
        fx: fx.source,
        xau: gold.source,
        xag: silver.source
      },
      generated_at: generatedAt,
      stale: false,
      note: usesFallback
        ? 'Una o più quotazioni TickBase non erano disponibili; è stata usata automaticamente una fonte di riserva.'
        : undefined
    };

    // Rimuove campi undefined dal JSON.
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Quotazioni aggiornate: ${payload.provider} - ${payload.as_of}`);
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

    const payload = {
      success: false,
      code: 'update_failed',
      message: error instanceof Error ? error.message : String(error),
      generated_at: new Date().toISOString()
    };
    await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.warn(`Aggiornamento non riuscito; pubblico comunque il sito con fallback browser: ${payload.message}`);
    // Non blocchiamo il deploy: il sito userà le fonti di riserva già presenti in script.js.
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
