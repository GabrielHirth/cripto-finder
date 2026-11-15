// Teste de integração com um "RESTHeart de mentirinha" em memória (mesmas regras de status:
// 401 sem Basic Auth, 201 ao criar, 200 ao alterar, 204 ao excluir, 404 se não existe).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor, dbs, pedidos } from './mock-restheart.js';

let server;
let api;

before(async () => {
  server = criarServidor();
  await new Promise((ok) => server.listen(0, ok));
  globalThis.API_BASE = `http://localhost:${server.address().port}`;
  api = await import('../frontend/api.js');
});

after(() => server.close());

test('primeira listagem em instalação nova cria a coleção e devolve lista vazia', async () => {
  assert.deepEqual(await api.listarMoedas(), []);
  assert.ok(dbs.has('cripto-finder'));
});

test('CRUD completo: POST 201, GET, PUT 200, PATCH 200, DELETE 204', async () => {
  const criada = await api.criarMoeda({ id: 'x', name: 'X', current_price: 1, favorito: false });
  assert.equal(criada.status, 201);
  assert.ok(criada.docId);

  const doc = await api.buscarMoeda(criada.docId);
  assert.equal(doc.name, 'X');

  assert.equal(await api.substituirMoeda(criada.docId, { id: 'x', name: 'X2', current_price: 2 }), 200);
  assert.equal((await api.buscarMoeda(criada.docId)).name, 'X2');

  assert.equal(await api.alterarMoeda(criada.docId, { favorito: true }), 200);
  const depois = await api.buscarMoeda(criada.docId);
  assert.equal(depois.favorito, true);
  assert.equal(depois.name, 'X2'); // PATCH não apaga os outros campos

  assert.equal(await api.excluirMoeda(criada.docId), 204);
  await assert.rejects(api.buscarMoeda(criada.docId), (e) => e.status === 404 && /404/.test(e.message));
});

test('importação: cria com POST e, na segunda vez, atualiza com PATCH sem apagar favorito/nota', async () => {
  const origem = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', current_price: 100, market_cap: 1000, roi: null },
    { id: 'ethereum', name: 'Ethereum', symbol: 'eth', current_price: 10, market_cap: 500, roi: { times: 3 } },
  ];
  const r1 = await api.salvarImportacao(origem);
  assert.deepEqual(r1, { criadas: 2, atualizadas: 0 });

  await api.alterarMoeda('bitcoin', { favorito: true, nota: 9 });
  const r2 = await api.salvarImportacao(origem.map((c) => ({ ...c, current_price: c.current_price * 2 })));
  assert.deepEqual(r2, { criadas: 0, atualizadas: 2 });

  const btc = await api.buscarMoeda('bitcoin');
  assert.equal(btc.current_price, 200); // preço atualizado
  assert.equal(btc.favorito, true); // escolha do usuário preservada
  assert.equal(btc.nota, 9);
  assert.deepEqual((await api.buscarMoeda('ethereum')).roi, { times: 3 }); // objeto embutido
});

test('carteira: lê (404 => null), salva e lê de novo', async () => {
  await api.garantirEstrutura();
  assert.equal(await api.lerCarteira('carteira-1'), null);
  await api.salvarCarteira({ _id: 'carteira-1', balance: 10000, holdings: [], transactions: [] });
  assert.equal((await api.lerCarteira('carteira-1')).balance, 10000);
});

test('todas as requisições levam Basic Auth (sem ele o RESTHeart devolve 401)', () => {
  assert.ok(pedidos.length > 10);
});
