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
 assert.match(html, /id="map-load"/);
});

test('il deployment include robots, sitemap e moduli applicativi', async () => {
 const workflow = await read('.github/workflows/update-market-prices.yml');
 assert.match(workflow, /sitemap\.xml/);
 assert.match(workflow, /robots\.txt/);
 assert.match(workflow, /pricing\.mjs/);
 assert.match(workflow, /images\/logo-navbar\.png/);
});

test('robots indica la sitemap canonica', async () => {
 const robots = await read('robots.txt');
 assert.match(robots, /Sitemap: https:\/\/comprooro\.emeraldgioielli\.com\/sitemap\.xml/);
});
