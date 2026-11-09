import {
  SALDO_INICIAL, ErroDeCarteira, mostrarReais, mostrarQuantidade, ajustarMoeda,
  criarCarteira, comprar, vender, calcularResumo,
} from './carteira.js';

const API_BASE = 'http://localhost:8080';
const URL_CRIPTO = `${API_BASE}/cripto`;
const URL_WALLET = `${API_BASE}/wallet`;
const CHAVE_CARTEIRA = 'cripto-finder:wallet-id';

const AUTH_BASICA = 'Basic ' + btoa('admin:secret');

// Estado
let listaMoedas = [];
let mapaMoedas = new Map();
let carteira = null;
let isLoading = false;
let estaSalvando = false;
let operacao = null;

// Elementos da UI
const listEl = document.getElementById('crypto-list');
const carteiraEl = document.getElementById('wallet');
const searchInput = document.getElementById('search');
const filterMarketCap = document.getElementById('filter-marketcap');
const filterChange = document.getElementById('filter-change');
const dialogEl = document.getElementById('trade-dialog');
const formEl = document.getElementById('trade-form');
const tituloEl = document.getElementById('trade-title');
const infoEl = document.getElementById('trade-info');
const rotuloEl = document.getElementById('trade-label');
const valorInput = document.getElementById('trade-value');
const atalhosEl = document.getElementById('trade-quick');
const previaEl = document.getElementById('trade-preview');
const erroEl = document.getElementById('trade-error');
const confirmarBtn = document.getElementById('trade-confirm');
const avisoEl = document.getElementById('toast');

function criarElemento(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function esvaziar(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let timerAviso;
function mostrarAviso(mensagem, erro = false) {
  avisoEl.textContent = mensagem;
  avisoEl.className = erro ? 'toast toast-error' : 'toast';
  avisoEl.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { avisoEl.hidden = true; }, 5000);
}

function criarImagem(url, alt) {
  if (!url) return null;
  const img = criarElemento('img', 'coin-img');
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

const corResultado = (n) => (n >= 0 ? 'positive-text' : 'negative-text');
const sinalDe = (n) => (n >= 0 ? '+' : '−');
const formatarResultado = (lucro, pct) =>
  `${sinalDe(lucro)} ${mostrarReais(Math.abs(lucro))} (${sinalDe(pct)}${Math.abs(pct).toFixed(2).replace('.', ',')}%)`;

const MSG_SEM_SERVIDOR =
  'Não consegui falar com o servidor. Confere se o Docker está rodando (docker-compose up -d) e tenta de novo.';

async function fazerRequisicao(url, opcoes) {
  try {
    const headers = { ...(opcoes?.headers || {}), Authorization: AUTH_BASICA };
    return await fetch(url, { ...opcoes, headers });
  } catch {
    throw new ErroDeCarteira(MSG_SEM_SERVIDOR);
  }
}

async function buscarMoedas() {
  const r = await fazerRequisicao(`${URL_CRIPTO}?pagesize=100`);
  if (r.status === 401) throw new ErroDeCarteira('O servidor recusou o acesso (erro 401). Confere o usuário e a senha do RestHeart.');
  if (!r.ok) throw new ErroDeCarteira('Não consegui carregar as moedas. Será que você já importou os dados? Rode "npm run import".');
  const dados = await r.json();
  listaMoedas = dados.map(ajustarMoeda);
  mapaMoedas = new Map(listaMoedas.map((m) => [m.id, m]));
}

async function criarColecao() {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fazerRequisicao(URL_WALLET, { method: 'PUT' });
    if (r.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function gravarCarteira(c) {
  const r = await fazerRequisicao(URL_WALLET, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });
  if (!r.ok) throw new ErroDeCarteira('Não consegui salvar sua carteira agora. Nada foi alterado, tenta de novo em instantes.');
}

async function carregarCarteira() {
  let id = localStorage.getItem(CHAVE_CARTEIRA);
  if (id) {
    const r = await fazerRequisicao(`${URL_WALLET}/${encodeURIComponent(id)}`);
    if (r.ok) {
      carteira = await r.json();
      return false;
    }
  }
  id = `carteira-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now())).slice(0, 8)}`;
  await criarColecao();
  const carteiraNova = criarCarteira(id);
  await gravarCarteira(carteiraNova);
  localStorage.setItem(CHAVE_CARTEIRA, id);
  carteira = carteiraNova;
  return true;
}

function renderWallet() {
  esvaziar(carteiraEl);
  if (!carteira) return;
  const r = calcularResumo(carteira, mapaMoedas);

  const cabecalho = criarElemento('div', 'wallet-top');
  const blocoTitulo = criarElemento('div');
  blocoTitulo.appendChild(criarElemento('h2', null, 'Minha carteira'));
  blocoTitulo.appendChild(criarElemento('p', 'muted', 'Dinheiro de mentirinha: aqui você treina sem arriscar nada.'));
  const resetBtn = criarElemento('button', 'btn btn-ghost btn-small', 'Recomeçar do zero');
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', resetarCarteira);
  cabecalho.append(blocoTitulo, resetBtn);
  carteiraEl.appendChild(cabecalho);

  const statsEl = criarElemento('div', 'stats');
  const criarStat = (rotulo, valor, classe) => {
    const s = criarElemento('div', 'stat');
    s.appendChild(criarElemento('div', 'label', rotulo));
    s.appendChild(criarElemento('div', `value ${classe || ''}`, valor));
    return s;
  };
  statsEl.append(
    criarStat('Disponível para comprar', mostrarReais(r.saldo)),
    criarStat('Valor das suas moedas', mostrarReais(r.valorAtual)),
    criarStat('Total na carteira', mostrarReais(r.total)),
  );
  if (r.investido > 0) {
    statsEl.appendChild(criarStat('Ganho ou perda', formatarResultado(r.lucro, r.lucroPct), corResultado(r.lucro)));
  }
  carteiraEl.appendChild(statsEl);

  if (r.posicoes.length === 0) {
    carteiraEl.appendChild(criarElemento('p', 'empty', 'Você ainda não tem nenhuma moeda. Escolha uma na lista abaixo e clique em "Comprar" para começar.'));
  } else {
    const ul = criarElemento('ul', 'holdings');
    r.posicoes.forEach((p) => {
      const li = criarElemento('li', 'holding');
      const img = criarImagem(p.image, p.name);
      if (img) li.appendChild(img);
      const infoPosicao = criarElemento('div', 'info');
      infoPosicao.appendChild(criarElemento('strong', null, `${p.name} (${p.symbol})`));
      infoPosicao.appendChild(criarElemento('span', null, `${mostrarQuantidade(p.amount)} ${p.symbol} · preço médio ${mostrarReais(p.avgPrice)}`));
      const resultadoEl = criarElemento('div', 'result');
      resultadoEl.appendChild(criarElemento('div', null, mostrarReais(p.valor)));
      resultadoEl.appendChild(criarElemento('div', corResultado(p.lucro), formatarResultado(p.lucro, p.lucroPct)));
      const vendBtn = criarElemento('button', 'btn btn-sell btn-small', 'Vender');
      vendBtn.type = 'button';
      vendBtn.addEventListener('click', () => abrirOperacao('sell', p.cryptoId));
      li.append(infoPosicao, resultadoEl, vendBtn);
      ul.appendChild(li);
    });
    carteiraEl.appendChild(ul);
  }

  if (carteira.transactions.length > 0) {
    const detalhes = criarElemento('details', 'history');
    detalhes.appendChild(criarElemento('summary', null, `Histórico (${carteira.transactions.length})`));
    const ul = criarElemento('ul');
    carteira.transactions.forEach((t) => {
      const li = criarElemento('li');
      const verbo = t.type === 'buy' ? 'Comprou' : 'Vendeu';
      li.appendChild(criarElemento('span', null, `${verbo} ${mostrarQuantidade(t.amount)} ${t.symbol} por ${mostrarReais(t.total)}`));
      li.appendChild(criarElemento('span', 'muted', new Date(t.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
      ul.appendChild(li);
    });
    detalhes.appendChild(ul);
    carteiraEl.appendChild(detalhes);
  }
}

// Renderiza lista filtrada
function renderList() {
  const search = searchInput.value.toLowerCase();
  const marketCapFilter = filterMarketCap.value;
  const changeFilter = filterChange.value;

  const filtered = listaMoedas.filter((item) => {
    // Busca por nome ou símbolo (converte campos para string para evitar erros se undefined)
    const matchesSearch = item.name.toLowerCase().includes(search) || item.symbol.toLowerCase().includes(search);
    if (!matchesSearch) return false;
    // Filtro market cap
    if (marketCapFilter === 'gt-1b' && item.marketCap <= 1000000000) return false;
    if (marketCapFilter === 'lt-1b' && item.marketCap >= 1000000000) return false;
    // Filtro variação 24h
    if (changeFilter === 'gt-0' && item.change24h <= 0) return false;
    if (changeFilter === 'lt-0' && item.change24h >= 0) return false;
    return true;
  });

  // Limpa lista atual
  esvaziar(listEl);
  if (filtered.length === 0) {
    listEl.appendChild(criarElemento('li', 'loading', 'Não encontramos nenhuma moeda com esses filtros. Tente limpar a busca.'));
    return;
  }

  filtered.forEach((item) => {
    const li = criarElemento('li', 'item');
    const cabecalho = criarElemento('div', 'item-head');
    const img = criarImagem(item.image, item.name);
    if (img) cabecalho.appendChild(img);

    const blocoInfo = criarElemento('div');
    // Título (Símbolo – Nome)
    const h2 = criarElemento('h2');
    h2.appendChild(criarElemento('span', 'symbol', item.symbol));
    h2.appendChild(document.createTextNode(` – ${item.name}`));
    blocoInfo.appendChild(h2);
    // Preço
    blocoInfo.appendChild(criarElemento('div', 'price', mostrarReais(item.price)));
    // Variação 24h
    const positivo = item.change24h >= 0;
    blocoInfo.appendChild(criarElemento(
      'div',
      `change ${positivo ? 'positive' : 'negative'}`,
      `${positivo ? '+' : ''}${item.change24h.toFixed(2).replace('.', ',')}% em 24h`
    ));
    // Market Cap
    blocoInfo.appendChild(criarElemento('div', 'marketcap', `Cap. de mercado: ${mostrarReais(item.marketCap)}`));
    cabecalho.appendChild(blocoInfo);
    li.appendChild(cabecalho);

    const acoesEl = criarElemento('div', 'item-actions');
    const comprarBtn = criarElemento('button', 'btn btn-primary btn-small', 'Comprar');
    comprarBtn.type = 'button';
    comprarBtn.addEventListener('click', () => abrirOperacao('buy', item.id));
    acoesEl.appendChild(comprarBtn);
    if (carteira?.holdings.some((h) => h.cryptoId === item.id)) {
      const venderBtn = criarElemento('button', 'btn btn-sell btn-small', 'Vender');
      venderBtn.type = 'button';
      venderBtn.addEventListener('click', () => abrirOperacao('sell', item.id));
      acoesEl.appendChild(venderBtn);
    }
    li.appendChild(acoesEl);
    listEl.appendChild(li);
  });
}

function buscarPosicao(id) {
  return carteira.holdings.find((h) => h.cryptoId === id);
}

function abrirOperacao(modo, id) {
  const moeda = mapaMoedas.get(id);
  if (!moeda || !carteira) return;
  operacao = { modo, moeda, tudo: false };
  erroEl.textContent = '';
  valorInput.value = '';
  esvaziar(atalhosEl);

  const compra = modo === 'buy';
  tituloEl.textContent = `${compra ? 'Comprar' : 'Vender'} ${moeda.name}`;
  rotuloEl.textContent = compra ? 'Quanto você quer investir (R$)?' : 'Quanto você quer vender (R$)?';
  confirmarBtn.textContent = compra ? 'Comprar' : 'Vender';

  if (compra) {
    infoEl.textContent = `Preço agora: ${mostrarReais(moeda.price)} · Você tem ${mostrarReais(carteira.balance)} disponíveis`;
  } else {
    const pos = buscarPosicao(id);
    const qtd = pos ? pos.amount : 0;
    infoEl.textContent = `Preço agora: ${mostrarReais(moeda.price)} · Você tem ${mostrarQuantidade(qtd)} ${moeda.symbol} (${mostrarReais(qtd * moeda.price)})`;
  }

  const opcoesAtalho = compra
    ? [['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['Tudo', 1]]
    : [['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['Tudo', 1]];
  opcoesAtalho.forEach(([rotulo, fracao]) => {
    const b = criarElemento('button', 'btn btn-ghost btn-small', rotulo);
    b.type = 'button';
    b.addEventListener('click', () => usarAtalho(fracao));
    atalhosEl.appendChild(b);
  });

  atualizarPrevia();
  dialogEl.showModal();
  valorInput.focus();
}

function usarAtalho(fracao) {
  const { modo, moeda } = operacao;
  if (modo === 'buy') {
    valorInput.value = (Math.floor(carteira.balance * fracao * 100) / 100).toFixed(2);
    operacao.tudo = false;
  } else {
    const pos = buscarPosicao(moeda.id);
    valorInput.value = ((pos?.amount || 0) * fracao * moeda.price).toFixed(2);
    operacao.tudo = fracao === 1;
  }
  erroEl.textContent = '';
  atualizarPrevia();
}

function atualizarPrevia() {
  if (!operacao) return;
  const { modo, moeda } = operacao;
  const valor = Number(valorInput.value);
  if (!(valor > 0)) {
    previaEl.textContent = '';
    return;
  }
  if (modo === 'buy') {
    previaEl.textContent = `Você vai receber cerca de ${mostrarQuantidade(valor / moeda.price)} ${moeda.symbol}.`;
  } else {
    const qtd = operacao.tudo ? buscarPosicao(moeda.id)?.amount : valor / moeda.price;
    previaEl.textContent = `Você vai vender ${mostrarQuantidade(qtd)} ${moeda.symbol}.`;
  }
}

valorInput.addEventListener('input', () => {
  if (operacao) operacao.tudo = false;
  erroEl.textContent = '';
  atualizarPrevia();
});

document.getElementById('trade-cancel').addEventListener('click', () => dialogEl.close());
dialogEl.addEventListener('close', () => { operacao = null; });

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!operacao || estaSalvando) return;
  const { modo, moeda, tudo } = operacao;

  try {
    let resultado;
    if (modo === 'buy') {
      resultado = comprar(carteira, moeda, valorInput.value);
    } else {
      const pos = buscarPosicao(moeda.id);
      const quantidade = tudo && pos ? pos.amount : Number(valorInput.value) / moeda.price;
      resultado = vender(carteira, moeda, quantidade);
    }

    estaSalvando = true;
    confirmarBtn.disabled = true;
    await gravarCarteira(resultado.carteira);
    carteira = resultado.carteira;

    dialogEl.close();
    renderWallet();
    renderList();
    const qtd = `${mostrarQuantidade(resultado.quantidade)} ${moeda.symbol}`;
    mostrarAviso(modo === 'buy'
      ? `Pronto! Você comprou ${qtd} por ${mostrarReais(resultado.total)}.`
      : `Pronto! Você vendeu ${qtd} e recebeu ${mostrarReais(resultado.total)}.`);
  } catch (err) {
    erroEl.textContent = err instanceof ErroDeCarteira ? err.message : 'Algo deu errado. Tenta de novo.';
  } finally {
    estaSalvando = false;
    confirmarBtn.disabled = false;
  }
});

async function resetarCarteira() {
  const confirmou = confirm(`Isso apaga suas moedas e o histórico e devolve ${mostrarReais(SALDO_INICIAL)} ao saldo. Quer recomeçar?`);
  if (!confirmou) return;
  try {
    const carteiraNova = criarCarteira(carteira._id);
    await gravarCarteira(carteiraNova);
    carteira = carteiraNova;
    renderWallet();
    renderList();
    mostrarAviso('Carteira zerada. Bora recomeçar!');
  } catch (err) {
    mostrarAviso(err.message, true);
  }
}

// Carrega dados iniciais
async function iniciarApp() {
  if (isLoading) return;
  isLoading = true;

  // Limpa lista de forma segura
  esvaziar(listEl);
  listEl.appendChild(criarElemento('li', 'loading', 'Carregando as moedas...'));

  try {
    await buscarMoedas();
    const primeiroAcesso = await carregarCarteira();
    renderWallet();
    renderList();
    if (primeiroAcesso) {
      mostrarAviso(`Bem-vindo! Criamos sua carteira com ${mostrarReais(SALDO_INICIAL)} de mentirinha para você testar.`);
    }
  } catch (e) {
    esvaziar(listEl);
    listEl.appendChild(criarElemento('li', 'error', e.message || 'Algo deu errado ao carregar.'));
  } finally {
    isLoading = false;
  }
}

// Eventos
searchInput.addEventListener('input', renderList);
filterMarketCap.addEventListener('change', renderList);
filterChange.addEventListener('change', renderList);

// Inicialização
iniciarApp();
