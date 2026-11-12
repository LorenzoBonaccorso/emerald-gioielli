import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la home espone i segnali SEO essenziali', async () => {
 const html = await read('index.html');
 assert.match(html, /<link rel="canonical" href="https:\/\/comprooro\.emeraldgioielli\.com\/"/);
 assert.match(html, /<meta name="robots" content="index, follow/);
 assert.equal((html.match(/<h1\b/g) || []).length, 1);
 assert.equal((html.match(/application\/ld\+json/g) || []).length, 2);
});

test('Analytics e Maps non vengono caricati prima di una scelta esplicita', async () => {
 const html = await read('index.html');
 assert.doesNotMatch(html, /<script[^>]+googletagmanager/);
 assert.doesNotMatch(html, /<iframe[^>]+google\.com\/maps/);
 assert.match(html, /id="cookie-accept"/);
 assert.match(html, /id="cookie-reject"/);
 assert.match(html, /Solo necessari/);
 assert.match(html, /Accetta analytics/);
 assert.match(html, /id="map-load"/);
});

test('la preferenza cookie è revocabile e Analytics resta opzionale', async () => {
 const [html, script] = await Promise.all([read('index.html'), read('script.js')]);
 assert.match(html, /id="cookie-manage"/);
 assert.match(html, /Privacy e cookie/);
 assert.match(script, /emerald_cookie_consent/);
 assert.match(script, /analytics_storage: 'denied'/);
 assert.match(script, /if \(consent === 'analytics'\) loadAnalytics\(\)/);
});

test('il deployment installa le dipendenze e genera le quotazioni prima della pubblicazione', async () => {
 const workflow = await read('.github/workflows/update-market-prices.yml');
 assert.match(workflow, /npm ci/);
 assert.match(workflow, /node scripts\/update-market-prices\.mjs/);
 assert.match(workflow, /npm run build/);
 assert.ok(workflow.indexOf('run: node scripts/update-market-prices.mjs') < workflow.indexOf('run: npm run build'));
 assert.match(workflow, /path: dist/);
});

test('robots indica la sitemap canonica', async () => {
 const robots = await read('robots.txt');
 assert.match(robots, /Sitemap: https:\/\/comprooro\.emeraldgioielli\.com\/sitemap\.xml/);
});
