import {
  SALDO_INICIAL, ErroCarteira, formatarReais, formatarQuantidade, normalizarMoeda,
  novaCarteira, comprar, vender, resumir,
} from './wallet-logic.js';
import * as api from './api.js';
import {
  validarFormulario, montarNovo, montarSubstituicao, valoresDoDocumento,
} from './documento.js';
import { calcularIndicadores, rankingPor, agruparPorTendencia } from './dashboard-logic.js';

const CHAVE_LOCAL = 'cripto-finder:wallet-id';

// Estado
let moedas = [];
let moedasPorId = new Map();
let carteira = null;
let isLoading = false;
let salvando = false;
let negociacao = null; // { modo: 'buy' | 'sell', moeda, tudo }
let formulario = null; // { modo: 'create' | 'edit', docId, original }

// Elementos da UI
const $ = (id) => document.getElementById(id);
const listEl = $('crypto-list');
const walletEl = $('wallet');
const searchInput = $('search');
const filterGroup = $('filter-group');
const filterChange = $('filter-change');
const dialog = $('trade-dialog');
const form = $('trade-form');
const tradeTitle = $('trade-title');
const tradeInfo = $('trade-info');
const tradeLabel = $('trade-label');
const tradeValue = $('trade-value');
const tradeQuick = $('trade-quick');
const tradePreview = $('trade-preview');
const tradeError = $('trade-error');
const tradeConfirm = $('trade-confirm');
const toastEl = $('toast');
const coinDialog = $('coin-dialog');
const coinForm = $('coin-form');
const coinSave = $('coin-save');
const coinError = $('coin-error');
const btnNew = $('btn-new');
const btnImport = $('btn-import');

// ---------- Utilidades de tela ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function limpar(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let toastTimer;
function avisar(mensagem, erro = false, ms = 5000) {
  toastEl.textContent = mensagem;
  toastEl.className = erro ? 'toast toast-error' : 'toast';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

const textoDoErro = (err) =>
  (err instanceof ErroCarteira ? err.message : 'Algo deu errado. Tenta de novo.');

function moedaImg(url, alt) {
  if (!url) return null;
  const img = el('img', 'coin-img');
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

const classeResultado = (n) => (n >= 0 ? 'positive-text' : 'negative-text');
const sinal = (n) => (n >= 0 ? '+' : '−');
const textoResultado = (lucro, pct) =>
  `${sinal(lucro)} ${formatarReais(Math.abs(lucro))} (${sinal(pct)}${Math.abs(pct).toFixed(2).replace('.', ',')}%)`;
const pct = (n) => `${n.toFixed(2).replace('.', ',')}%`;
const bilhoes = (n) => `R$ ${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;

// ---------- Dados ----------
async function carregarMoedas() {
  const docs = await api.listarMoedas();
  moedas = docs.map(normalizarMoeda);
  moedasPorId = new Map(moedas.map((m) => [m.id, m]));
}

// Depois de qualquer POST, PUT, PATCH ou DELETE: lê de novo do banco e redesenha TUDO,
// por isso os indicadores e gráficos se atualizam sozinhos.
async function recarregar() {
  await carregarMoedas();
  renderTudo();
}

async function abrirCarteira() {
  const id = localStorage.getItem(CHAVE_LOCAL);
  if (id) {
    const existente = await api.lerCarteira(id);
    if (existente) {
      carteira = existente;
      return false;
    }
  }
  // Primeira visita (ou carteira apagada): cria uma nova
  const novoId = `carteira-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now())).slice(0, 8)}`;
  await api.garantirEstrutura();
  const nova = novaCarteira(novoId);
  await api.salvarCarteira(nova);
  localStorage.setItem(CHAVE_LOCAL, novoId);
  carteira = nova;
  return true;
}

const salvarCarteira = api.salvarCarteira;

function renderTudo() {
  renderPainel();
  renderCarteira();
  renderList();
}

// ---------- Painel ----------
let graficoBarras = null;
let graficoPizza = null;
const CORES = ['#146c43', '#75b798', '#ea868f', '#b02a37'];

function renderPainel() {
  const ind = calcularIndicadores(moedas);
  const box = $('indicators');
  limpar(box);
  const card = (rotulo, valor, classe) => {
    const c = el('div', 'stat');
    c.appendChild(el('div', 'label', rotulo));
    c.appendChild(el('div', `value ${classe || ''}`, valor));
    return c;
  };
  box.append(
    card('Moedas no banco', String(ind.total)),
    card('Valor de mercado somado', moedas.length ? bilhoes(ind.capTotal) : '—'),
    card('Variação média 24h', moedas.length ? pct(ind.mediaVariacao) : '—', moedas.length ? classeResultado(ind.mediaVariacao) : ''),
    card('Maior alta 24h', ind.maiorAlta ? `${ind.maiorAlta.nome} (${pct(ind.maiorAlta.valor)})` : '—'),
    card('Moedas em alta', moedas.length ? `${ind.pctEmAlta.toFixed(0)}%` : '—'),
    card('Favoritas', String(ind.favoritas)),
    card('Nota média', ind.notaMedia == null ? '—' : ind.notaMedia.toFixed(1).replace('.', ',')),
  );

  // Ranking: top 5 maiores altas
  const rk = $('ranking');
  limpar(rk);
  if (moedas.length === 0) rk.appendChild(el('li', 'muted', 'Sem dados ainda.'));
  rankingPor(moedas, 'change24h', 5).forEach((m) => {
    const li = el('li');
    li.appendChild(el('span', null, `${m.name} (${m.symbol})`));
    li.appendChild(el('strong', classeResultado(m.change24h), `${m.change24h >= 0 ? '+' : ''}${pct(m.change24h)}`));
    rk.appendChild(li);
  });

  // Agrupamento por categoria
  const grupos = agruparPorTendencia(moedas);
  const gl = $('groups');
  limpar(gl);
  grupos.forEach((g) => {
    const li = el('li');
    li.appendChild(el('span', null, g.rotulo));
    li.appendChild(el('strong', null, String(g.qtd)));
    gl.appendChild(li);
  });

  desenharGraficos(grupos);
}

function desenharGraficos(grupos) {
  if (typeof Chart === 'undefined') {
    $('charts-fallback').hidden = false;
    return;
  }
  const top = rankingPor(moedas, 'marketCap', 10);
  const barras = {
    labels: top.map((m) => m.symbol),
    datasets: [{
      label: 'Valor de mercado (R$ bilhões)',
      data: top.map((m) => Number((m.marketCap / 1e9).toFixed(1))),
      backgroundColor: '#0a58ca',
    }],
  };
  const pizza = {
    labels: grupos.map((g) => g.rotulo),
    datasets: [{ data: grupos.map((g) => g.qtd), backgroundColor: CORES }],
  };
  const comum = { responsive: true, maintainAspectRatio: false };

  if (graficoBarras) {
    graficoBarras.data = barras;
    graficoBarras.update();
  } else {
    graficoBarras = new Chart($('chart-bar'), {
      type: 'bar', data: barras, options: { ...comum, plugins: { legend: { display: false } } },
    });
  }
  if (graficoPizza) {
    graficoPizza.data = pizza;
    graficoPizza.update();
  } else {
    graficoPizza = new Chart($('chart-pie'), {
      type: 'pie', data: pizza, options: { ...comum, plugins: { legend: { position: 'bottom' } } },
    });
  }
}

// ---------- Renderização da carteira ----------
function renderCarteira() {
  limpar(walletEl);
  if (!carteira) return;
  const r = resumir(carteira, moedasPorId);

  const topo = el('div', 'wallet-top');
  const titulo = el('div');
  titulo.appendChild(el('h2', null, 'Minha carteira'));
  titulo.appendChild(el('p', 'muted', 'Dinheiro de mentirinha: aqui você treina sem arriscar nada.'));
  const reset = el('button', 'btn btn-ghost btn-small', 'Recomeçar do zero');
  reset.type = 'button';
  reset.addEventListener('click', recomecar);
  topo.append(titulo, reset);
  walletEl.appendChild(topo);

  const stats = el('div', 'stats');
  const stat = (rotulo, valor, classe) => {
    const s = el('div', 'stat');
    s.appendChild(el('div', 'label', rotulo));
    s.appendChild(el('div', `value ${classe || ''}`, valor));
    return s;
  };
  stats.append(
    stat('Disponível para comprar', formatarReais(r.saldo)),
    stat('Valor das suas moedas', formatarReais(r.valorAtual)),
    stat('Total na carteira', formatarReais(r.total)),
  );
  if (r.investido > 0) {
    stats.appendChild(stat('Ganho ou perda', textoResultado(r.lucro, r.lucroPct), classeResultado(r.lucro)));
  }
  walletEl.appendChild(stats);

  if (r.posicoes.length === 0) {
    walletEl.appendChild(el('p', 'empty', 'Você ainda não tem nenhuma moeda. Escolha uma na lista abaixo e clique em "Comprar" para começar.'));
  } else {
    const ul = el('ul', 'holdings');
    r.posicoes.forEach((p) => {
      const li = el('li', 'holding');
      const img = moedaImg(p.image, p.name);
      if (img) li.appendChild(img);
      const info = el('div', 'info');
      info.appendChild(el('strong', null, `${p.name} (${p.symbol})`));
      info.appendChild(el('span', null, `${formatarQuantidade(p.amount)} ${p.symbol} · preço médio ${formatarReais(p.avgPrice)}`));
      const res = el('div', 'result');
      res.appendChild(el('div', null, formatarReais(p.valor)));
      res.appendChild(el('div', classeResultado(p.lucro), textoResultado(p.lucro, p.lucroPct)));
      const vend = el('button', 'btn btn-sell btn-small', 'Vender');
      vend.type = 'button';
      vend.addEventListener('click', () => abrirNegociacao('sell', p.cryptoId));
      li.append(info, res, vend);
      ul.appendChild(li);
    });
    walletEl.appendChild(ul);
  }

  if (carteira.transactions.length > 0) {
    const det = el('details', 'history');
    det.appendChild(el('summary', null, `Histórico (${carteira.transactions.length})`));
    const ul = el('ul');
    carteira.transactions.forEach((t) => {
      const li = el('li');
      const verbo = t.type === 'buy' ? 'Comprou' : 'Vendeu';
      li.appendChild(el('span', null, `${verbo} ${formatarQuantidade(t.amount)} ${t.symbol} por ${formatarReais(t.total)}`));
      li.appendChild(el('span', 'muted', new Date(t.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
      ul.appendChild(li);
    });
    det.appendChild(ul);
    walletEl.appendChild(det);
  }
}

// ---------- Lista de moedas ----------
function renderList() {
  const search = searchInput.value.trim().toLowerCase();
  const grupo = filterGroup.value;
  const changeFilter = filterChange.value;
  const top10 = new Set(rankingPor(moedas, 'marketCap', 10).map((m) => m.id));

  const filtered = moedas.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search) && !item.symbol.toLowerCase().includes(search)) return false;
    if (grupo === 'fav' && !item.favorito) return false;
    if (grupo === 'top10' && !top10.has(item.id)) return false;
    if (changeFilter === 'gt-0' && item.change24h <= 0) return false;
    if (changeFilter === 'lt-0' && item.change24h >= 0) return false;
    return true;
  });

  limpar(listEl);
  if (moedas.length === 0) {
    listEl.appendChild(el('li', 'loading', 'Ainda não há moedas no banco. Use "Importar da CoinGecko" ou "+ Nova moeda".'));
    return;
  }
  if (filtered.length === 0) {
    listEl.appendChild(el('li', 'loading', 'Não encontramos nenhuma moeda com esses filtros. Tente limpar a busca.'));
    return;
  }

  const botao = (rotulo, classe, aoClicar, titulo) => {
    const b = el('button', `btn ${classe} btn-small`, rotulo);
    b.type = 'button';
    if (titulo) b.title = titulo;
    b.addEventListener('click', aoClicar);
    return b;
  };

  filtered.forEach((item) => {
    const li = el('li', 'item');
    const topo = el('div', 'item-head');
    const img = moedaImg(item.image, item.name);
    if (img) topo.appendChild(img);

    const bloco = el('div', 'item-body');
    const h2 = el('h2');
    h2.appendChild(el('span', 'symbol', item.symbol));
    h2.appendChild(document.createTextNode(` – ${item.name}${item.favorito ? ' ★' : ''}`));
    bloco.appendChild(h2);
    bloco.appendChild(el('div', 'price', formatarReais(item.price)));
    const positivo = item.change24h >= 0;
    bloco.appendChild(el('div', `change ${positivo ? 'positive' : 'negative'}`, `${positivo ? '+' : ''}${pct(item.change24h)} em 24h`));
    bloco.appendChild(el('div', 'marketcap', `Cap. de mercado: ${formatarReais(item.marketCap)}`));
    if (item.nota != null) bloco.appendChild(el('div', 'marketcap', `Minha nota: ${item.nota}/10`));
    if (item.comentario) bloco.appendChild(el('div', 'comment', item.comentario));
    if (item.tags.length) {
      const tags = el('div', 'tags');
      item.tags.forEach((t) => tags.appendChild(el('span', 'tag', t)));
      bloco.appendChild(tags);
    }
    topo.appendChild(bloco);
    li.appendChild(topo);

    const acoes = el('div', 'item-actions');
    acoes.appendChild(botao('Comprar', 'btn-primary', () => abrirNegociacao('buy', item.id)));
    if (carteira?.holdings.some((h) => h.cryptoId === item.id)) {
      acoes.appendChild(botao('Vender', 'btn-sell', () => abrirNegociacao('sell', item.id)));
    }
    acoes.appendChild(botao(item.favorito ? '★ Favorita' : '☆ Favoritar', 'btn-ghost', () => alternarFavorito(item)));
    acoes.appendChild(botao('Editar', 'btn-ghost', () => editar(item)));
    acoes.appendChild(botao('Excluir', 'btn-sell', () => excluir(item)));
    li.appendChild(acoes);
    listEl.appendChild(li);
  });
}

// ---------- CRUD das moedas ----------
// PATCH: muda só o campo favorito (e a data de atualização).
async function alternarFavorito(m) {
  try {
    const novo = !m.favorito;
    const status = await api.alterarMoeda(m.docId, { favorito: novo, atualizadoEm: new Date().toISOString() });
    await recarregar();
    avisar(`${m.name} ${novo ? 'marcada como favorita' : 'removida dos favoritos'} (PATCH ${status}).`);
  } catch (err) {
    avisar(textoDoErro(err), true);
  }
}

// DELETE com confirmação.
async function excluir(m) {
  if (carteira?.holdings.some((h) => h.cryptoId === m.id)) {
    avisar(`Você tem ${m.name} na carteira. Venda tudo antes de excluir a moeda.`, true);
    return;
  }
  if (!confirm(`Excluir ${m.name} do banco? Isso não pode ser desfeito.`)) return;
  try {
    const status = await api.excluirMoeda(m.docId);
    await recarregar();
    avisar(`${m.name} excluída (DELETE ${status}).`);
  } catch (err) {
    avisar(textoDoErro(err), true);
  }
}

// GET por id e depois PUT: abre o formulário de edição com o documento atual do banco.
async function editar(m) {
  try {
    const doc = await api.buscarMoeda(m.docId);
    abrirFormulario('edit', doc, m.docId);
  } catch (err) {
    avisar(textoDoErro(err), true);
    if (err.status === 404) recarregar().catch(() => {});
  }
}

const CAMPOS = [
  ['name', 'f-name'], ['symbol', 'f-symbol'], ['price', 'f-price'], ['marketCap', 'f-marketcap'],
  ['change24h', 'f-change'], ['nota', 'f-nota'], ['tags', 'f-tags'], ['comentario', 'f-comentario'],
];

function abrirFormulario(modo, doc, docId) {
  formulario = { modo, docId, original: doc };
  const v = modo === 'edit'
    ? valoresDoDocumento(doc)
    : { name: '', symbol: '', price: '', marketCap: '', change24h: 0, nota: '', comentario: '', tags: '', favorito: false };
  CAMPOS.forEach(([chave, id]) => { $(id).value = v[chave]; });
  $('f-favorito').checked = v.favorito;
  $('coin-title').textContent = modo === 'edit' ? `Editar ${doc.name}` : 'Nova moeda';
  mostrarErros({});
  coinError.textContent = '';
  coinDialog.showModal();
  $('f-name').focus();
}

function mostrarErros(erros) {
  coinForm.querySelectorAll('[data-erro]').forEach((s) => { s.textContent = erros[s.dataset.erro] || ''; });
}

function lerFormulario() {
  const v = {};
  CAMPOS.forEach(([chave, id]) => { v[chave] = $(id).value; });
  v.favorito = $('f-favorito').checked;
  return v;
}

coinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!formulario || salvando) return;
  const valores = lerFormulario();
  const idsOcupados = formulario.modo === 'create' ? new Set(moedas.map((m) => m.id)) : undefined;
  const { valido, erros } = validarFormulario(valores, { idsOcupados });
  mostrarErros(erros);
  if (!valido) {
    coinError.textContent = 'Corrija os campos marcados em vermelho.';
    return;
  }
  coinError.textContent = '';
  salvando = true;
  coinSave.disabled = true;
  coinSave.textContent = 'Salvando...';
  try {
    let mensagem;
    if (formulario.modo === 'create') {
      const r = await api.criarMoeda(montarNovo(valores));
      mensagem = `${valores.name.trim()} criada (POST ${r.status}).`;
    } else {
      const status = await api.substituirMoeda(formulario.docId, montarSubstituicao(formulario.original, valores));
      mensagem = `${valores.name.trim()} salva (PUT ${status}).`;
    }
    coinDialog.close();
    await recarregar();
    avisar(mensagem);
  } catch (err) {
    coinError.textContent = textoDoErro(err);
  } finally {
    salvando = false;
    coinSave.disabled = false;
    coinSave.textContent = 'Salvar';
  }
});

coinDialog.addEventListener('close', () => { formulario = null; });
$('coin-cancel').addEventListener('click', () => coinDialog.close());
btnNew.addEventListener('click', () => abrirFormulario('create'));

// GET na CoinGecko + POST (novas) / PATCH (já existentes) no banco.
async function importar() {
  if (btnImport.disabled) return;
  btnImport.disabled = true;
  avisar('Buscando as moedas na CoinGecko...', false, 0);
  try {
    const r = await api.importarMoedas((feitas, total) => avisar(`Salvando no banco: ${feitas}/${total}...`, false, 0));
    await recarregar();
    avisar(`Importação concluída: ${r.criadas} novas (POST) e ${r.atualizadas} atualizadas (PATCH).`);
  } catch (err) {
    avisar(textoDoErro(err), true, 9000);
  } finally {
    btnImport.disabled = false;
  }
}
btnImport.addEventListener('click', importar);

// ---------- Janela de compra e venda ----------
function posicaoDe(id) {
  return carteira.holdings.find((h) => h.cryptoId === id);
}

function abrirNegociacao(modo, id) {
  const moeda = moedasPorId.get(id);
  if (!moeda || !carteira) return;
  negociacao = { modo, moeda, tudo: false };
  tradeError.textContent = '';
  tradeValue.value = '';
  limpar(tradeQuick);

  const compra = modo === 'buy';
  tradeTitle.textContent = `${compra ? 'Comprar' : 'Vender'} ${moeda.name}`;
  tradeLabel.textContent = compra ? 'Quanto você quer investir (R$)?' : 'Quanto você quer vender (R$)?';
  tradeConfirm.textContent = compra ? 'Comprar' : 'Vender';

  if (compra) {
    tradeInfo.textContent = `Preço agora: ${formatarReais(moeda.price)} · Você tem ${formatarReais(carteira.balance)} disponíveis`;
  } else {
    const pos = posicaoDe(id);
    const qtd = pos ? pos.amount : 0;
    tradeInfo.textContent = `Preço agora: ${formatarReais(moeda.price)} · Você tem ${formatarQuantidade(qtd)} ${moeda.symbol} (${formatarReais(qtd * moeda.price)})`;
  }

  const atalhos = compra
    ? [['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['Tudo', 1]]
    : [['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['Tudo', 1]];
  atalhos.forEach(([rotulo, fracao]) => {
    const b = el('button', 'btn btn-ghost btn-small', rotulo);
    b.type = 'button';
    b.addEventListener('click', () => aplicarAtalho(fracao));
    tradeQuick.appendChild(b);
  });

  atualizarPreview();
  dialog.showModal();
  tradeValue.focus();
}

function aplicarAtalho(fracao) {
  const { modo, moeda } = negociacao;
  if (modo === 'buy') {
    // arredonda para baixo para nunca passar do saldo
    tradeValue.value = (Math.floor(carteira.balance * fracao * 100) / 100).toFixed(2);
    negociacao.tudo = false;
  } else {
    const pos = posicaoDe(moeda.id);
    tradeValue.value = ((pos?.amount || 0) * fracao * moeda.price).toFixed(2);
    negociacao.tudo = fracao === 1;
  }
  tradeError.textContent = '';
  atualizarPreview();
}

function atualizarPreview() {
  if (!negociacao) return;
  const { modo, moeda } = negociacao;
  const valor = Number(tradeValue.value);
  if (!(valor > 0)) {
    tradePreview.textContent = '';
    return;
  }
  if (modo === 'buy') {
    tradePreview.textContent = `Você vai receber cerca de ${formatarQuantidade(valor / moeda.price)} ${moeda.symbol}.`;
  } else {
    const qtd = negociacao.tudo ? posicaoDe(moeda.id)?.amount : valor / moeda.price;
    tradePreview.textContent = `Você vai vender ${formatarQuantidade(qtd)} ${moeda.symbol}.`;
  }
}

tradeValue.addEventListener('input', () => {
  if (negociacao) negociacao.tudo = false;
  tradeError.textContent = '';
  atualizarPreview();
});

document.getElementById('trade-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { negociacao = null; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!negociacao || salvando) return;
  const { modo, moeda, tudo } = negociacao;

  try {
    let resultado;
    if (modo === 'buy') {
      resultado = comprar(carteira, moeda, tradeValue.value);
    } else {
      const pos = posicaoDe(moeda.id);
      const quantidade = tudo && pos ? pos.amount : Number(tradeValue.value) / moeda.price;
      resultado = vender(carteira, moeda, quantidade);
    }

    salvando = true;
    tradeConfirm.disabled = true;
    await salvarCarteira(resultado.carteira);
    carteira = resultado.carteira;

    dialog.close();
    renderCarteira();
    renderList();
    const qtd = `${formatarQuantidade(resultado.quantidade)} ${moeda.symbol}`;
    avisar(modo === 'buy'
      ? `Pronto! Você comprou ${qtd} por ${formatarReais(resultado.total)}.`
      : `Pronto! Você vendeu ${qtd} e recebeu ${formatarReais(resultado.total)}.`);
  } catch (err) {
    tradeError.textContent = textoDoErro(err);
  } finally {
    salvando = false;
    tradeConfirm.disabled = false;
  }
});

async function recomecar() {
  const ok = confirm(`Isso apaga suas moedas e o histórico e devolve ${formatarReais(SALDO_INICIAL)} ao saldo. Quer recomeçar?`);
  if (!ok) return;
  try {
    const nova = novaCarteira(carteira._id);
    await salvarCarteira(nova);
    carteira = nova;
    renderCarteira();
    renderList();
    avisar('Carteira zerada. Bora recomeçar!');
  } catch (err) {
    avisar(textoDoErro(err), true);
  }
}

// ---------- Inicialização ----------
async function iniciar() {
  if (isLoading) return;
  isLoading = true;
  limpar(listEl);
  listEl.appendChild(el('li', 'loading', 'Carregando as moedas...'));

  try {
    await carregarMoedas();
    const primeiraVez = await abrirCarteira();
    renderTudo();
    if (moedas.length === 0) {
      await importar(); // banco vazio: importa sozinho (GET na CoinGecko + POST no banco)
    } else if (primeiraVez) {
      avisar(`Bem-vindo! Criamos sua carteira com ${formatarReais(SALDO_INICIAL)} de mentirinha para você testar.`);
    }
  } catch (e) {
    limpar(listEl);
    listEl.appendChild(el('li', 'error', textoDoErro(e)));
    renderPainel();
  } finally {
    isLoading = false;
  }
}

searchInput.addEventListener('input', renderList);
filterGroup.addEventListener('change', renderList);
filterChange.addEventListener('change', renderList);

iniciar();
