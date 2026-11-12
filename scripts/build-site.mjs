import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { readQuoteSnapshot } from '../quote-snapshot.mjs';
import { SOGLIA_PROMO_GRAMMI } from '../pricing.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const euro = (value, digits) => value.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderQuoteHtml(template, snapshot, now = Date.now()) {
 const quote = readQuoteSnapshot(snapshot, now);
 const values = {
  'price-gold18': euro(quote.promo18, 1),
  'price-gold24': euro(quote.gold24, 2),
  'price-silver800': euro(quote.argento800, 2),
  'gold18-offer-title': `Offerta ${euro(quote.promo18, 1)} €/g per almeno ${SOGLIA_PROMO_GRAMMI} grammi`,
  'gold18-offer-text': `Sotto i ${SOGLIA_PROMO_GRAMMI} grammi: ${euro(quote.standard18, 1)} €/g. Prezzi già comprensivi delle commissioni.`,
  'metals-live-text': 'QUOTAZIONE PUBBLICATA',
  'metal-total': `${euro(quote.standard18, 1)} €`,
  'converter-note': `Prezzo sotto soglia: ${euro(quote.standard18, 1)} €/g. Offerta da ${SOGLIA_PROMO_GRAMMI} g: ${euro(quote.promo18, 1)} €/g.`
 };
 let html = template;
 for (const [id, value] of Object.entries(values)) {
  const pattern = new RegExp(`(<([a-z]+)\\b[^>]*\\bid="${id}"[^>]*>)[^<]*(</\\2>)`, 'g');
  if ([...html.matchAll(pattern)].length !== 1) throw new Error(`Elemento quotazione assente o duplicato: ${id}`);
  html = html.replace(pattern, (_, open, tag, close) => `${open}${escapeHtml(value)}${close}`);
 }
 const marker = '<!-- initial-market-data -->';
 if (html.split(marker).length !== 2) throw new Error('Segnaposto dei dati iniziali non valido.');
 return html.replace(marker, `<script type="application/json" id="initial-market-data">${JSON.stringify(snapshot).replace(/</g, '\\u003c')}</script>`);
}

export async function buildSite({ root = projectRoot, outputDir = join(root, 'dist'), now = Date.now(), snapshot } = {}) {
 snapshot ??= JSON.parse(await readFile(join(root, 'data/metal-prices.json'), 'utf8'));
 let html = renderQuoteHtml(await readFile(join(root, 'index.html'), 'utf8'), snapshot, now);
 const bundle = await build({
  entryPoints: [join(root, 'script.js')], bundle: true, write: false, metafile: true,
  format: 'iife', platform: 'browser', target: ['es2020'], charset: 'utf8', legalComments: 'none'
 });
 const javascript = bundle.outputFiles[0].contents;
 const hash = createHash('sha256').update(javascript).digest('hex').slice(0, 12);
 const filename = `app-${hash}.js`;
 const scriptTag = '<script type="module" src="script.js?v=102"></script>';
 if (!html.includes(scriptTag)) throw new Error('Script iniziale non trovato.');
 html = html.replace(scriptTag, `<script defer src="${filename}"></script>`);
 await mkdir(outputDir, { recursive: true });
 await writeFile(join(outputDir, filename), javascript);
 await writeFile(join(outputDir, 'index.html'), html, 'utf8');
 for (const file of ['style.css', 'sitemap.xml', 'robots.txt', 'CNAME', 'images/favicon.jpg', 'images/logo-navbar.png', 'data/market-prices.json']) {
  const destination = join(outputDir, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, file), destination);
 }
 await writeFile(join(outputDir, 'data/metal-prices.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
 await writeFile(join(outputDir, '.nojekyll'), '');
 return { html, filename, metafile: bundle.metafile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 buildSite().then(({ filename }) => console.log(`Sito generato in dist: quotazioni HTML e ${filename}`)).catch(error => {
  console.error(`Build fallita: ${error.message}`);
  process.exitCode = 1;
 });
}
