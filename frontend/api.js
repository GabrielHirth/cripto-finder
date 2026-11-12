// Toda a comunicação HTTP do projeto: RESTHeart (banco NoSQL) e CoinGecko (origem dos dados).
// Não mexe na tela. Também é usado pelo script `npm run import` (Node 18+).
import { ErroCarteira } from './wallet-logic.js';
import { enriquecer, idString } from './documento.js';

const env = globalThis.process?.env ?? {};
export const API_BASE = globalThis.API_BASE ?? env.API_BASE ?? 'http://localhost:8080';
// No RESTHeart padrão, a raiz "/" já aponta para o banco `restheart`: o 1º trecho da URL é a COLEÇÃO.
export const URL_MOEDAS = `${API_BASE}/cripto-finder`;
export const URL_CARTEIRAS = `${API_BASE}/wallets`;

// Usuário padrão do RESTHeart. Sem este cabeçalho o RESTHeart responde 401 em tudo.
// Só é aceitável porque o banco roda na máquina local (regra da atividade).
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${btoa('admin:secret')}`,
};

const MSG_SERVIDOR =
  'Não consegui falar com o servidor (HTTP 0). Confere se o Docker está rodando (docker compose up -d) e tenta de novo.';

// Erro que carrega o status HTTP. Herda de ErroCarteira para a tela tratar igual.
export class ErroApi extends ErroCarteira {
  constructor(mensagem, status = 0) {
    super(mensagem);
    this.status = status;
  }
}

const cod = encodeURIComponent;

async function requisitar(url, metodo = 'GET', corpo) {
  try {
    return await fetch(url, {
      method: metodo,
      headers: HEADERS,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(MSG_SERVIDOR, 0);
  }
}

// fetch NÃO dispara erro em 404/500: por isso conferimos res.ok sempre.
function exigir(r, acao) {
  if (r.ok) return r;
  const dica = r.status === 401 ? ' Usuário ou senha do RESTHeart incorretos.' : '';
  throw new ErroApi(`${acao} (HTTP ${r.status}).${dica}`, r.status);
}

// ---------- Banco: coleções ----------
// PUT /{coleção}: cria (201) ou confirma (200) a coleção.
export async function garantirEstrutura() {
  for (const url of [URL_MOEDAS, URL_CARTEIRAS]) {
    exigir(await requisitar(url, 'PUT'), `Não consegui criar a coleção ${url.split('/').pop()}`);
  }
}

// ---------- Banco: moedas (CRUD) ----------
// GET: lista tudo (o RESTHeart devolve no máximo 100 por página).
export async function listarMoedas() {
  const todos = [];
  for (let pagina = 1; pagina <= 10; pagina += 1) {
    const r = await requisitar(`${URL_MOEDAS}?pagesize=100&page=${pagina}`);
    if (r.status === 404) {
      if (pagina === 1) await garantirEstrutura(); // instalação nova: cria e devolve lista vazia
      return todos;
    }
    exigir(r, 'Não consegui carregar as moedas');
    const docs = await r.json();
    todos.push(...docs);
    if (docs.length < 100) break;
  }
  return todos;
}

// GET /{id}: busca um documento. 404 vira erro com mensagem clara.
export async function buscarMoeda(docId) {
  const r = await requisitar(`${URL_MOEDAS}/${cod(docId)}`);
  if (r.status === 404) throw new ErroApi('Essa moeda não existe mais no banco (HTTP 404).', 404);
  exigir(r, 'Não consegui buscar a moeda');
  return r.json();
}

// POST: cria um documento. O id gerado vem no cabeçalho Location.
export async function criarMoeda(doc) {
  const r = exigir(await requisitar(URL_MOEDAS, 'POST', doc), 'Não consegui criar a moeda');
  const local = r.headers.get('Location');
  return { status: r.status, docId: local ? local.split('/').pop() : null };
}

// PUT: substitui o documento inteiro.
export async function substituirMoeda(docId, doc) {
  const r = exigir(await requisitar(`${URL_MOEDAS}/${cod(docId)}`, 'PUT', doc), 'Não consegui salvar a moeda');
  return r.status;
}

// PATCH: altera só os campos enviados (ex.: favorito).
export async function alterarMoeda(docId, campos) {
  const r = exigir(await requisitar(`${URL_MOEDAS}/${cod(docId)}`, 'PATCH', campos), 'Não consegui alterar a moeda');
  return r.status;
}

// DELETE: remove (204 No Content).
export async function excluirMoeda(docId) {
  const r = exigir(await requisitar(`${URL_MOEDAS}/${cod(docId)}`, 'DELETE'), 'Não consegui excluir a moeda');
  return r.status;
}

// ---------- Banco: carteira ----------
export async function lerCarteira(id) {
  const r = await requisitar(`${URL_CARTEIRAS}/${cod(id)}`);
  if (r.status === 404) return null;
  exigir(r, 'Não consegui abrir sua carteira');
  return r.json();
}

export async function salvarCarteira(c) {
  exigir(
    await requisitar(`${URL_CARTEIRAS}/${cod(c._id)}`, 'PUT', c),
    'Não consegui salvar sua carteira agora. Nada foi alterado, tenta de novo em instantes'
  );
}

// ---------- Origem: CoinGecko (somente GET) ----------
export async function buscarCoinGecko(quantidade = 30) {
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'brl');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', String(quantidade));
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');
  let r;
  try {
    r = await fetch(url);
  } catch {
    throw new ErroApi('Não consegui acessar a CoinGecko. Confere a internet e tenta de novo.', 0);
  }
  if (r.status === 429) {
    throw new ErroApi('A CoinGecko limitou as requisições (HTTP 429). Espera 1 minuto e tenta de novo.', 429);
  }
  if (!r.ok) throw new ErroApi(`A CoinGecko respondeu com erro (HTTP ${r.status}).`, r.status);
  return r.json();
}

// Grava no banco: moeda nova => POST; moeda que já existe => PATCH só dos dados de mercado,
// assim favorito, nota e comentário do usuário não são apagados ao atualizar os preços.
export async function salvarImportacao(moedas, aoProgredir, agora = new Date()) {
  const existentes = new Map(
    (await listarMoedas()).map((d) => [d.id ?? idString(d._id), idString(d._id)])
  );
  let criadas = 0;
  let atualizadas = 0;
  let feitas = 0;
  for (const coin of moedas) {
    const docId = existentes.get(coin.id);
    if (docId) {
      await alterarMoeda(docId, { ...coin, atualizadoEm: agora.toISOString() });
      atualizadas += 1;
    } else {
      await criarMoeda(enriquecer(coin, agora));
      criadas += 1;
    }
    feitas += 1;
    aoProgredir?.(feitas, moedas.length);
  }
  return { criadas, atualizadas };
}

export async function importarMoedas(aoProgredir) {
  return salvarImportacao(await buscarCoinGecko(), aoProgredir);
}
