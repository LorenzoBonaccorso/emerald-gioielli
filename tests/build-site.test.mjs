import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { buildSite, renderQuoteHtml } from '../scripts/build-site.mjs';
import { createQuoteSnapshot, readQuoteSnapshot, latestValidSnapshot, MAX_SNAPSHOT_AGE_MS } from '../quote-snapshot.mjs';
import { TROY_OUNCE_GRAMS } from '../pricing.mjs';

const now = Date.parse('2026-11-12T12:00:00Z');
const market = { oroEurOncia: 100 * TROY_OUNCE_GRAMS, argentoEurOncia: 2 * TROY_OUNCE_GRAMS, asOf: '2026-11-12T00:00:00Z', stale: false, provider: 'Gold-API + Test FX', mode: 'spot' };
const snapshot = createQuoteSnapshot(market, now);
const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('le quotazioni HTML sono leggibili senza eseguire JavaScript e mantengono fonte e data reali', () => {
 const html = renderQuoteHtml(template, snapshot, now);
 assert.match(html, /id="price-gold24"[^>]*>100,00</);
 assert.match(html, /id="price-gold18"[^>]*>67,1</);
 assert.match(html, /id="price-silver800"[^>]*>1,05</);
 assert.match(html, /Sotto i 30 grammi: 64,1 €/);
 assert.match(html, /id="metal-total">64,1 €/);
 assert.match(html, /id="metals-source">Gold-API \+ Test FX</);
 assert.match(html, /id="metals-updated"[^>]*>12\/11\/26, 01:00:00</);
 assert.match(html, /QUOTAZIONE PUBBLICATA/);
 assert.doesNotMatch(html, /--,--|--:--:--/);
});

test('scadenza e dati di origine restano vincolanti anche se il file viene rigenerato', () => {
 assert.throws(() => readQuoteSnapshot(snapshot, now + MAX_SNAPSHOT_AGE_MS + 1), /scaduta/);
 for (const replacement of [{ asOf: '2026-08-14' }, { asOf: null }, { stale: true }, { oroEurOncia: 0 }, { argentoEurOncia: null }]) {
  assert.throws(() => createQuoteSnapshot({ ...market, ...replacement }, now));
 }
 assert.throws(() => readQuoteSnapshot({ ...snapshot, generated_at: '2026-11-13T12:00:00Z' }, now));
 assert.equal(readQuoteSnapshot(snapshot, now).asOf.toISOString(), market.asOf.replace('Z', '.000Z'));
});

test('la riserva sceglie il dato valido più recente e non rinnova la sua scadenza', () => {
 const older = createQuoteSnapshot({ ...market, oroEurOncia: 99 * TROY_OUNCE_GRAMS }, now - 60000);
 const expired = createQuoteSnapshot(market, now - MAX_SNAPSHOT_AGE_MS - 1);
 assert.equal(latestValidSnapshot([older, snapshot, expired, { market: {} }], now), snapshot);
 assert.equal(latestValidSnapshot([older, snapshot], now + MAX_SNAPSHOT_AGE_MS + 1), null);
});

test('fonte e JSON incorporato non possono chiudere un tag script', () => {
 const malicious = createQuoteSnapshot({ ...market, provider: '</script><img src=x onerror=alert(1)>' }, now);
 const html = renderQuoteHtml(template, malicious, now);
 assert.match(html, /&lt;\/script&gt;&lt;img/);
 const json = html.match(/id="initial-market-data">([^]*?)<\/script>/)[1];
 assert.doesNotMatch(json, /</);
 assert.equal(JSON.parse(json).market.provider, malicious.market.provider);
});

test('il pacchetto pubblico contiene un solo script senza import remoti e funziona con API offline', async t => {
 const directory = await mkdtemp(join(tmpdir(), 'emerald-build-'));
 t.after(async () => {
  // Rimuove solo la directory temporanea appena creata, verificata nel percorso previsto.
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(directory.split(/[\\/]/).at(-1).startsWith('emerald-build-'));
  await rm(directory, { recursive: true });
 });
 const { html, filename, metafile } = await buildSite({ outputDir: directory, now, snapshot });
 assert.equal((html.match(/<script[^>]+src=/g) || []).length, 1);
 assert.match(html, /<script defer src="app-[a-f0-9]+\.js"><\/script>/);
 assert.equal(Object.values(metafile.outputs).flatMap(output => output.imports).length, 0);
 const code = await readFile(join(directory, filename), 'utf8');
 const compiled = new vm.Script(code);
 const elements = new Map();
 for (const id of ['price-gold18', 'price-gold24', 'price-silver800', 'metals-updated', 'metals-source', 'metals-live-text', 'metal-total', 'converter-note', 'metal-grams']) {
  elements.set(id, { textContent: '', value: '1', addEventListener() {} });
 }
 elements.set('initial-market-data', { textContent: JSON.stringify(snapshot) });
 class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
 const context = {
  Date: TestDate, console: { warn() {} }, setTimeout, clearTimeout, AbortController,
  fetch: async () => { throw new Error('offline'); },
  localStorage: { getItem() { throw new Error('storage blocked'); } },
  document: { hidden: false, cookie: '', getElementById: id => elements.get(id) ?? null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  window: { addEventListener() {}, setInterval() {}, location: { hash: '', protocol: 'https:' } }
 };
 compiled.runInNewContext(context);
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(elements.get('price-gold24').textContent, '100,00');
 assert.equal(elements.get('metals-live-text').textContent, 'ULTIMO DATO');
 assert.equal(elements.get('metal-total').textContent, '64,1 €');
 // Ripetendo con lo stesso HTML oltre la scadenza, il client rifiuta i vecchi valori.
 TestDate.now = () => now + MAX_SNAPSHOT_AGE_MS + 1;
 compiled.runInNewContext(context);
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(elements.get('price-gold24').textContent, 'N/D');
 assert.equal(elements.get('metals-live-text').textContent, 'DATI NON DISPONIBILI');
 await assert.rejects(buildSite({ outputDir: directory, now: now + MAX_SNAPSHOT_AGE_MS + 1, snapshot }), /scaduta/);
});
