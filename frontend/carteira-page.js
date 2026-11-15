import * as api from './api.js';
import { comprar, vender, resumir, normalizarMoeda, formatarReais, formatarQuantidade } from './wallet-logic.js';

let carteiras = [];
let moedas = [];
let dialogModo = 'create'; // 'create' | 'edit'
let carteiraOriginal = null;
let compra = null; // carteira em aberto no diálogo de compra
let visualizadorCarteira = null;

const $ = (id) => document.getElementById(id);
const toastEl = $('toast');

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const mapaMoedas = () => new Map(moedas.map((m) => [m.id, m]));

let toastTimer;
function avisar(msg, erro = false, ms = 5000) {
  toastEl.textContent = msg;
  toastEl.className = erro ? 'toast toast-error' : 'toast';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

function preencherSelect(select, opcoes) {
  select.textContent = '';
  opcoes.forEach(([valor, rotulo]) => {
    const opt = el('option');
    opt.value = valor;
    opt.textContent = rotulo;
    select.appendChild(opt);
  });
}

// ---------- Lista de carteiras ----------
async function carregar() {
  const listEl = $('wallet-list');
  listEl.textContent = '';
  listEl.appendChild(el('li', 'loading', 'Carregando carteiras...'));
  try {
    [carteiras, moedas] = await Promise.all([api.listarCarteiras(), api.listarMoedas()]);
    moedas = moedas.map(normalizarMoeda);
    render();
  } catch (err) {
    listEl.textContent = '';
    listEl.appendChild(el('li', 'error', err.message || 'Erro ao carregar'));
  }
}

function botao(rotulo, classe, aoClicar) {
  const b = el('button', `btn ${classe} btn-small`, rotulo);
  b.type = 'button';
  b.addEventListener('click', aoClicar);
  return b;
}

function render() {
  const listEl = $('wallet-list');
  listEl.textContent = '';
  if (carteiras.length === 0) {
    listEl.appendChild(el('li', 'loading', 'Nenhuma carteira cadastrada ainda. Clique em "+ Nova carteira".'));
    return;
  }
  const mapa = mapaMoedas();
  carteiras.forEach((c) => {
    const li = el('li', 'item');
    const body = el('div', 'item-body');
    const h2 = el('h2');
    h2.appendChild(el('strong', null, 'ID: '));
    h2.appendChild(document.createTextNode(c._id));
    body.append(
      h2,
      el('div', 'price', `Saldo: ${brl.format(c.balance || 0)}`),
      el('div', 'marketcap', `Posições: ${(c.holdings || []).length} · Transações: ${(c.transactions || []).length} · Total: ${formatarReais(resumir(c, mapa).total)}`),
      el('div', 'marketcap', `Criada em: ${c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '—'}`),
    );
    const actions = el('div', 'item-actions');
    actions.append(
      botao('Editar (PUT)', 'btn-ghost', () => abrirFormulario('edit', c)),
      botao('+R$ 1000 (PATCH)', 'btn-primary', () => somarSaldo(c)),
      botao('Ver ativos & Swap', 'btn-ghost', () => abrirVisualizador(c)),
      botao('Comprar', 'btn-primary', () => abrirCompra(c)),
      botao('Excluir', 'btn-sell', () => excluir(c._id)),
    );
    li.append(body, actions);
    listEl.appendChild(li);
  });
}

// ---------- Criar / editar (POST / PUT) ----------
function abrirFormulario(modo, c = null) {
  dialogModo = modo;
  carteiraOriginal = c;
  $('wallet-title').textContent = modo === 'create' ? 'Nova carteira (POST)' : `Editar ${c._id} (PUT)`;
  $('w-id').value = modo === 'create' ? `carteira-${Math.random().toString(36).slice(2, 8)}` : c._id;
  $('w-id').disabled = modo === 'edit';
  $('w-balance').value = modo === 'create' ? '10000' : c.balance ?? 0;
  $('wallet-error').textContent = '';
  $('wallet-dialog').showModal();
}

async function somarSaldo(c) {
  try {
    const novoBalance = Number(c.balance || 0) + 1000;
    await api.alterarCarteira(c._id, { balance: novoBalance });
    await carregar();
    avisar(`Saldo de ${c._id} atualizado para ${brl.format(novoBalance)} (PATCH 200).`);
  } catch (err) {
    avisar(err.message, true);
  }
}

async function excluir(id) {
  if (!confirm(`Excluir carteira ${id}?`)) return;
  try {
    await api.excluirCarteira(id);
    await carregar();
    avisar(`Carteira ${id} excluída (DELETE 204).`);
  } catch (err) {
    avisar(err.message, true);
  }
}

$('wallet-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('w-id').value.trim();
  const balance = Number($('w-balance').value);
  const errorEl = $('wallet-error');
  if (!id) return void (errorEl.textContent = 'Informe o ID da carteira.');
  if (!Number.isFinite(balance) || balance < 0) return void (errorEl.textContent = 'Saldo inválido.');

  const saveBtn = $('wallet-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  errorEl.textContent = '';
  try {
    if (dialogModo === 'create') {
      const res = await api.criarCarteira({
        _id: id, balance, holdings: [], transactions: [], createdAt: new Date().toISOString(),
      });
      avisar(`Carteira criada (POST ${res.status}).`);
    } else {
      await api.salvarCarteira({ ...carteiraOriginal, balance });
      avisar('Carteira salva (PUT 200/201).');
    }
    $('wallet-dialog').close();
    await carregar();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
};

$('btn-nova-carteira').onclick = () => abrirFormulario('create');
$('btn-recarregar').onclick = carregar;
$('wallet-cancel').onclick = () => $('wallet-dialog').close();

// ---------- Compra simulada ----------
function abrirCompra(c) {
  if (moedas.length === 0) {
    avisar('Nenhum criptoativo no banco. Importe as moedas na página principal primeiro.', true);
    return;
  }
  compra = c;
  $('buy-error').textContent = '';
  $('buy-valor').value = '';
  $('buy-preview').textContent = '';
  $('buy-title').textContent = `Comprar com ${c._id}`;
  $('buy-info').textContent = `Saldo disponível: ${formatarReais(c.balance)}`;
  preencherSelect($('buy-moeda'), moedas.map((m) => [m.id, `${m.name} (${m.symbol}) - ${formatarReais(m.price)}`]));
  atualizarPreviewCompra();
  $('buy-dialog').showModal();
  $('buy-valor').focus();
}

function atualizarPreviewCompra() {
  if (!compra) return;
  const moeda = mapaMoedas().get($('buy-moeda').value);
  const valor = Number($('buy-valor').value);
  $('buy-preview').textContent = moeda && valor > 0
    ? `Você vai receber cerca de ${formatarQuantidade(valor / moeda.price)} ${moeda.symbol}.`
    : '';
}

$('buy-moeda').onchange = atualizarPreviewCompra;
$('buy-valor').oninput = () => { $('buy-error').textContent = ''; atualizarPreviewCompra(); };
$('buy-cancel').onclick = () => $('buy-dialog').close();
$('buy-dialog').addEventListener('close', () => { compra = null; });

$('buy-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!compra) return;
  const moeda = mapaMoedas().get($('buy-moeda').value);
  const confirmBtn = $('buy-confirm');
  try {
    const resultado = comprar(compra, moeda, $('buy-valor').value);
    confirmBtn.disabled = true;
    await api.salvarCarteira(resultado.carteira);
    $('buy-dialog').close();
    await carregar();
    avisar(`Pronto! Comprou ${formatarQuantidade(resultado.quantidade)} ${moeda.symbol} por ${formatarReais(resultado.total)}.`);
  } catch (err) {
    $('buy-error').textContent = err.message;
  } finally {
    confirmBtn.disabled = false;
  }
};

// ---------- Visualizador de ativos, venda e swap ----------
function abrirVisualizador(c) {
  visualizadorCarteira = c;
  renderizarVisualizador();
  $('wallet-details-dialog').showModal();
}

function renderizarVisualizador() {
  if (!visualizadorCarteira) return;
  const c = visualizadorCarteira;
  const mapa = mapaMoedas();
  const r = resumir(c, mapa);

  $('details-title').textContent = `Ativos da carteira: ${c._id}`;

  const summary = $('details-summary');
  summary.textContent = '';
  const stats = el('div', 'stats');
  const stat = (label, value) => {
    const s = el('div', 'stat');
    s.append(el('div', 'label', label), el('div', 'value', value));
    return s;
  };
  stats.append(
    stat('Disponível (BRL)', formatarReais(c.balance)),
    stat('Valor em Cripto', formatarReais(r.valorAtual)),
    stat('Total Geral', formatarReais(r.total)),
  );
  summary.appendChild(stats);

  const box = $('details-holdings');
  box.textContent = '';
  if (r.posicoes.length === 0) {
    box.appendChild(el('p', 'empty', 'Nenhum criptoativo nesta carteira.'));
  } else {
    const ul = el('ul', 'holdings');
    r.posicoes.forEach((p) => {
      const li = el('li', 'holding');
      const info = el('div', 'info');
      info.append(
        el('strong', null, `${p.name} (${p.symbol})`),
        el('span', null, `${formatarQuantidade(p.amount)} ${p.symbol} · Preço médio: ${formatarReais(p.avgPrice)} · Atual: ${formatarReais(p.precoAtual)}`),
      );
      const res = el('div', 'result');
      res.append(
        el('div', null, formatarReais(p.valor)),
        el('div', p.lucro >= 0 ? 'positive-text' : 'negative-text', `${p.lucro >= 0 ? '+' : ''}${formatarReais(p.lucro)} (${p.lucroPct.toFixed(2)}%)`),
      );
      li.append(info, res, botao('Vender 100%', 'btn-sell', () => venderTudo(p, mapa)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  preencherSelect($('swap-from'), [
    ['BRL', `BRL (Saldo: ${formatarReais(c.balance)})`],
    ...c.holdings.map((h) => [h.cryptoId, `${h.symbol} (Qtd: ${formatarQuantidade(h.amount)})`]),
  ]);
  preencherSelect($('swap-to'), moedas.map((m) => [m.id, `${m.name} (${m.symbol}) - ${formatarReais(m.price)}`]));
  atualizarPreviewSwap();
}

async function venderTudo(posicao, mapa) {
  try {
    const resVenda = vender(visualizadorCarteira, mapa.get(posicao.cryptoId), posicao.amount);
    await api.salvarCarteira(resVenda.carteira);
    visualizadorCarteira = resVenda.carteira;
    await carregar();
    renderizarVisualizador();
    avisar(`Vendido ${formatarQuantidade(posicao.amount)} ${posicao.symbol} por ${formatarReais(resVenda.total)}.`);
  } catch (err) {
    avisar(err.message, true);
  }
}

function atualizarPreviewSwap() {
  if (!visualizadorCarteira) return;
  const fromId = $('swap-from').value;
  const toId = $('swap-to').value;
  const qtd = Number($('swap-amount').value);
  const preview = $('swap-preview');
  if (!(qtd > 0) || fromId === toId) return void (preview.textContent = '');
  const mapa = mapaMoedas();
  const destino = mapa.get(toId);
  if (!destino) return;

  if (fromId === 'BRL') {
    preview.textContent = qtd > visualizadorCarteira.balance
      ? 'Saldo em BRL insuficiente.'
      : `Investindo ${formatarReais(qtd)} você receberá ~${formatarQuantidade(qtd / destino.price)} ${destino.symbol}.`;
  } else {
    const holding = visualizadorCarteira.holdings.find((h) => h.cryptoId === fromId);
    const origem = mapa.get(fromId);
    if (!holding || !origem) return;
    const valorBrl = qtd * origem.price;
    preview.textContent = qtd > holding.amount
      ? `Quantidade de ${origem.symbol} excede o que você possui.`
      : `Trocando ${formatarQuantidade(qtd)} ${origem.symbol} (~${formatarReais(valorBrl)}) por ~${formatarQuantidade(valorBrl / destino.price)} ${destino.symbol}.`;
  }
}

$('swap-from').onchange = atualizarPreviewSwap;
$('swap-to').onchange = atualizarPreviewSwap;
$('swap-amount').oninput = () => { $('swap-error').textContent = ''; atualizarPreviewSwap(); };

$('swap-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!visualizadorCarteira) return;
  const fromId = $('swap-from').value;
  const toId = $('swap-to').value;
  const qtd = Number($('swap-amount').value);
  if (fromId === toId) return void ($('swap-error').textContent = 'A origem e o destino devem ser diferentes.');
  if (!(qtd > 0)) return void ($('swap-error').textContent = 'Informe uma quantidade válida.');

  const mapa = mapaMoedas();
  const destino = mapa.get(toId);
  const confirmBtn = $('swap-confirm');
  try {
    let nova = visualizadorCarteira;
    if (fromId === 'BRL') {
      nova = comprar(nova, destino, qtd).carteira;
    } else {
      const venda = vender(nova, mapa.get(fromId), qtd);
      nova = comprar(venda.carteira, destino, venda.total).carteira;
    }
    confirmBtn.disabled = true;
    await api.salvarCarteira(nova);
    visualizadorCarteira = nova;
    await carregar();
    renderizarVisualizador();
    $('swap-amount').value = '';
    avisar('Swap realizado com sucesso!');
  } catch (err) {
    $('swap-error').textContent = err.message;
  } finally {
    confirmBtn.disabled = false;
  }
};

$('details-close').onclick = () => $('wallet-details-dialog').close();
$('wallet-details-dialog').addEventListener('close', () => { visualizadorCarteira = null; });

carregar();
