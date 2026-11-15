// RESTHeart de mentirinha, em memória, usado pelos testes.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

export const dbs = new Map(); // "banco/coleção" -> Map(id -> doc)
export const pedidos = [];

function responder(res, status, corpo, cabecalhos = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...cabecalhos,
  });
  res.end(corpo === undefined ? undefined : JSON.stringify(corpo));
}

export function criarServidor() {
  return http.createServer((req, res) => {
    let texto = '';
    req.on('data', (c) => { texto += c; });
    req.on('end', () => {
      const corpo = texto ? JSON.parse(texto) : undefined;
      // Como no RESTHeart padrão: /{coleção}/{id}. Um 3º trecho (/x/y/z) não existe.
      const partes = decodeURIComponent(req.url.split('?')[0]).split('/').slice(1);
      const [colecao, id, extra] = partes;
      pedidos.push(`${req.method} ${req.url.split('?')[0]}`);
      if (req.headers.authorization !== `Basic ${Buffer.from('admin:secret').toString('base64')}`) {
        return responder(res, 401);
      }
      if (req.method === 'OPTIONS') return responder(res, 200);
      if (!colecao || extra !== undefined) return responder(res, 404);
      if (!id) {
        if (req.method === 'PUT') {
          const novo = !dbs.has(colecao);
          if (novo) dbs.set(colecao, new Map());
          return responder(res, novo ? 201 : 200);
        }
        const col = dbs.get(colecao);
        if (!col) return responder(res, 404);
        if (req.method === 'GET') return responder(res, 200, [...col.values()]);
        if (req.method === 'POST') {
          const novoId = corpo._id ?? { $oid: randomBytes(12).toString('hex') };
          const chaveId = typeof novoId === 'object' ? novoId.$oid : novoId;
          if (col.has(chaveId)) return responder(res, 409);
          col.set(chaveId, { ...corpo, _id: novoId });
          return responder(res, 201, undefined, { Location: `http://localhost/${colecao}/${chaveId}` });
        }
      } else {
        const col = dbs.get(colecao);
        if (!col) return responder(res, 404);
        const atual = col.get(id);
        if (req.method === 'PUT') {
          col.set(id, { ...corpo, _id: atual?._id ?? id });
          return responder(res, atual ? 200 : 201);
        }
        if (!atual) return responder(res, 404);
        if (req.method === 'GET') return responder(res, 200, atual);
        if (req.method === 'PATCH') { col.set(id, { ...atual, ...corpo }); return responder(res, 200); }
        if (req.method === 'DELETE') { col.delete(id); return responder(res, 204); }
      }
      return responder(res, 405);
    });
  });
}
