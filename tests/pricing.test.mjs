import test from 'node:test';
import assert from 'node:assert/strict';
import {
 arrotondaAlPasso,
 calcolaPrezziDaMercato,
 prezzoOro18PerPeso
} from '../pricing.mjs';

test('arrotonda i prezzi ai passi commerciali previsti', () => {
 assert.equal(arrotondaAlPasso(67.125, 0.1), 67.1);
 assert.equal(arrotondaAlPasso(0.5236, 0.01), 0.52);
});

test('calcola oro 18K e argento 800 da valori puri', () => {
 assert.deepEqual(calcolaPrezziDaMercato(100, 1), {
  standard18: 64.1,
  promo18: 67.1,
  argento800: 0.52
 });
});

test('applica la soglia promozionale esattamente da 30 grammi', () => {
 const prezzi = { standard18: 64.1, promo18: 67.1 };
 assert.equal(prezzoOro18PerPeso(29.99, prezzi), 64.1);
 assert.equal(prezzoOro18PerPeso(30, prezzi), 67.1);
});

test('rifiuta input non validi', () => {
 assert.throws(() => calcolaPrezziDaMercato(0, 1), /numero positivo/);
 assert.throws(() => prezzoOro18PerPeso(-1, { standard18: 1, promo18: 2 }), /peso/);
});
