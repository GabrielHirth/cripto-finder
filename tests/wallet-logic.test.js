import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  novaCarteira, comprar, vender, resumir, normalizarMoeda, ErroCarteira, SALDO_INICIAL,
} from '../frontend/wallet-logic.js';

const btc = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 100000 };

test('carteira nova começa com saldo fictício e vazia', () => {
  const c = novaCarteira('x');
  assert.equal(c.balance, SALDO_INICIAL);
  assert.deepEqual(c.holdings, []);
});

test('comprar desconta o saldo e cria a posição', () => {
  const { carteira, quantidade } = comprar(novaCarteira('x'), btc, 1000);
  assert.equal(carteira.balance, 9000);
  assert.equal(quantidade, 0.01);
  assert.equal(carteira.holdings[0].avgPrice, 100000);
  assert.equal(carteira.transactions[0].type, 'buy');
});

test('preço médio é recalculado na segunda compra', () => {
  let c = comprar(novaCarteira('x'), btc, 1000).carteira;
  c = comprar(c, { ...btc, price: 50000 }, 1000).carteira;
  // 0,01 BTC a 100k + 0,02 BTC a 50k = R$ 2000 / 0,03
  assert.ok(Math.abs(c.holdings[0].avgPrice - 2000 / 0.03) < 1e-6);
});

test('compra acima do saldo é recusada com mensagem amigável', () => {
  assert.throws(() => comprar(novaCarteira('x'), btc, 20000), (e) =>
    e instanceof ErroCarteira && e.message.includes('saldo'));
});

test('valores inválidos são recusados', () => {
  for (const v of [0, -5, NaN, 'abc']) {
    assert.throws(() => comprar(novaCarteira('x'), btc, v), ErroCarteira);
  }
});

test('vender devolve o dinheiro e remove a posição quando zera', () => {
  const c = comprar(novaCarteira('x'), btc, 1000).carteira;
  const r = vender(c, { ...btc, price: 110000 }, 0.01);
  assert.equal(r.total, 1100);
  assert.equal(r.carteira.balance, 10100);
  assert.equal(r.carteira.holdings.length, 0);
});

test('vender mais do que tem ou sem ter é recusado', () => {
  const c = comprar(novaCarteira('x'), btc, 1000).carteira;
  assert.throws(() => vender(c, btc, 1), ErroCarteira);
  assert.throws(() => vender(novaCarteira('x'), btc, 0.1), ErroCarteira);
});

test('a carteira original não é alterada (sem efeito colateral)', () => {
  const original = novaCarteira('x');
  comprar(original, btc, 500);
  assert.equal(original.balance, SALDO_INICIAL);
});

test('resumo calcula lucro e total', () => {
  const c = comprar(novaCarteira('x'), btc, 1000).carteira;
  const mapa = new Map([['bitcoin', { ...btc, price: 120000 }]]);
  const r = resumir(c, mapa);
  assert.equal(r.valorAtual, 1200);
  assert.equal(r.lucro, 200);
  assert.equal(r.lucroPct, 20);
  assert.equal(r.total, 10200);
});

test('normalizarMoeda aceita formato CoinGecko e formato simples', () => {
  const a = normalizarMoeda({ id: 'bitcoin', symbol: 'btc', current_price: 5, market_cap: 9, price_change_percentage_24h: 1.5 });
  const b = normalizarMoeda({ _id: 'bitcoin', symbol: 'BTC', price: 5, marketCap: 9, change24h: 1.5 });
  assert.deepEqual(a, b);
});
