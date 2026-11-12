import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  idString, slug, enriquecer, validarFormulario, montarNovo, montarSubstituicao, valoresDoDocumento,
} from '../frontend/documento.js';
import { normalizarMoeda } from '../frontend/wallet-logic.js';
import { calcularIndicadores, rankingPor, agruparPorTendencia } from '../frontend/dashboard-logic.js';

const valido = { name: 'Moeda Teste', symbol: 'MTT', price: '10.5', marketCap: '1000', change24h: '2', nota: '', comentario: '', tags: '', favorito: false };

test('idString entende _id texto e { $oid }', () => {
  assert.equal(idString('bitcoin'), 'bitcoin');
  assert.equal(idString({ $oid: 'abc123' }), 'abc123');
});

test('slug tira acento e símbolos', () => {
  assert.equal(slug('  Moeda Ótima!! 2 '), 'moeda-otima-2');
});

test('enriquecer cria os campos do grupo e uma lista embutida', () => {
  const d = enriquecer({ id: 'bitcoin', name: 'Bitcoin' }, new Date('2026-11-08T10:00:00Z'));
  assert.equal(d._id, 'bitcoin');
  assert.equal(d.favorito, false);
  assert.deepEqual(d.tags, []);
  assert.equal(d.criadoEm, '2026-11-08T10:00:00.000Z');
});

test('formulário válido passa; inválido devolve erro por campo', () => {
  assert.equal(validarFormulario(valido).valido, true);
  const r = validarFormulario({ ...valido, name: '', symbol: 'a b', price: '0', marketCap: '-1', change24h: '-200', nota: '11' });
  assert.equal(r.valido, false);
  for (const campo of ['name', 'symbol', 'price', 'marketCap', 'change24h', 'nota']) assert.ok(r.erros[campo], campo);
});

test('nome repetido é recusado na criação', () => {
  const r = validarFormulario(valido, { idsOcupados: new Set(['moeda-teste']) });
  assert.ok(r.erros.name);
});

test('tags: máximo de 5', () => {
  assert.ok(validarFormulario({ ...valido, tags: 'a,b,c,d,e,f' }).erros.tags);
});

test('montarNovo gera documento com 6+ campos, número, data e lista', () => {
  const d = montarNovo({ ...valido, tags: 'x, y' }, new Date('2026-11-08T10:00:00Z'));
  assert.ok(Object.keys(d).length >= 6);
  assert.equal(typeof d.current_price, 'number');
  assert.equal(d.criadoEm, '2026-11-08T10:00:00.000Z');
  assert.deepEqual(d.tags, ['x', 'y']);
  assert.equal(d._id, undefined);
});

test('montarSubstituicao preserva campos do banco e não manda _id', () => {
  const original = { _id: { $oid: 'a1' }, _etag: { $oid: 'e' }, id: 'bitcoin', roi: { times: 2 }, criadoEm: 'antes', name: 'Bitcoin' };
  const d = montarSubstituicao(original, { ...valido, name: 'Bitcoin 2' });
  assert.equal(d._id, undefined);
  assert.equal(d._etag, undefined);
  assert.deepEqual(d.roi, { times: 2 });
  assert.equal(d.criadoEm, 'antes');
  assert.equal(d.name, 'Bitcoin 2');
});

test('valoresDoDocumento devolve texto para o formulário', () => {
  const v = valoresDoDocumento({ name: 'A', symbol: 'a', current_price: 3, tags: ['x', 'y'], nota: null });
  assert.equal(v.symbol, 'A');
  assert.equal(v.tags, 'x, y');
  assert.equal(v.nota, '');
});

test('normalizarMoeda aceita _id como { $oid } (documento criado pelo formulário)', () => {
  const m = normalizarMoeda({ _id: { $oid: 'abc' }, id: 'minha-moeda', name: 'X', symbol: 'x', current_price: 1 });
  assert.equal(m.docId, 'abc');
  assert.equal(m.id, 'minha-moeda');
});

const moedas = [
  { name: 'A', symbol: 'A', marketCap: 300, change24h: 6, favorito: true, nota: 8 },
  { name: 'B', symbol: 'B', marketCap: 200, change24h: 1, favorito: false, nota: null },
  { name: 'C', symbol: 'C', marketCap: 100, change24h: -2, favorito: false, nota: 6 },
  { name: 'D', symbol: 'D', marketCap: 50, change24h: -9, favorito: true, nota: null },
];

test('indicadores do painel', () => {
  const i = calcularIndicadores(moedas);
  assert.equal(i.total, 4);
  assert.equal(i.capTotal, 650);
  assert.equal(i.mediaVariacao, -1);
  assert.deepEqual(i.maiorAlta, { nome: 'A', valor: 6 });
  assert.equal(i.pctEmAlta, 50);
  assert.equal(i.favoritas, 2);
  assert.equal(i.notaMedia, 7);
});

test('painel com lista vazia não quebra', () => {
  const i = calcularIndicadores([]);
  assert.equal(i.total, 0);
  assert.equal(i.maiorAlta, null);
  assert.equal(i.notaMedia, null);
});

test('ranking e agrupamento', () => {
  assert.deepEqual(rankingPor(moedas, 'marketCap', 2).map((m) => m.name), ['A', 'B']);
  assert.deepEqual(agruparPorTendencia(moedas).map((g) => g.qtd), [1, 1, 1, 1]);
});
