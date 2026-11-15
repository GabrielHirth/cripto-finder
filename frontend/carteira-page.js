import * as api from './api.js';
import { comprar, vender, resumir, normalizarMoeda, formatarReais, formatarQuantidade } from './wallet-logic.js';

let carteiras = [];
let dialogModo = 'create'; // 'create' | 'edit'
let carteiraOriginal = null;
let moedas = []; // criptoativos disponíveis para compra

const $ = (id) => document.getElementById(id);
const listEl = $('wallet-list');
const dialog = $('wallet-dialog');
const form = $('wallet-form');
const titleEl = $('wallet-title');
const errorEl = $('wallet-error');
const saveBtn = $('wallet-save');
const toastEl = $('toast');

let toastTimer;
function avisar(msg, erro = false, ms = 5000) {
  toastEl.textContent = msg;
  toastEl.className = erro ? 'toast toast-error' : 'toast';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

async function carregar() {
  listEl.textContent = '';
  const liLoad = document.createElement('li');
  liLoad.className = 'loading';
  liLoad.textContent = 'Carregando carteiras...';
  listEl.appendChild(liLoad);
  try {
    [carteiras, moedas] = await Promise.all([api.listarCarteiras(), api.listarMoedas()]);
    moedas = moedas.map(normalizarMoeda);
    render();
  } catch (err) {
    listEl.textContent = '';
    const liErr = document.createElement('li');
    liErr.className = 'error';
    liErr.textContent = err.message || 'Erro ao carregar';
    listEl.appendChild(liErr);
  }
}

function render() {
  listEl.textContent = '';
  if (carteiras.length === 0) {
    const liEmpty = document.createElement('li');
    liEmpty.className = 'loading';
    liEmpty.textContent = 'Nenhuma carteira cadastrada ainda. Clique em "+ Nova carteira".';
    listEl.appendChild(liEmpty);
    return;
  }
  carteiras.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'item';

    const body = document.createElement('div');
    body.className = 'item-body';

    const h2 = document.createElement('h2');
    const strongId = document.createElement('strong');
    strongId.textContent = 'ID: ';
    h2.appendChild(strongId);
    h2.appendChild(document.createTextNode(c._id));
    body.appendChild(h2);

    const divPrice = document.createElement('div');
    divPrice.className = 'price';
    divPrice.textContent = `Saldo: ${brl.format(c.balance || 0)}`;
    body.appendChild(divPrice);

    const divMc = document.createElement('div');
    divMc.className = 'marketcap';
    const r = resumir(c, new Map(moedas.map((m) => [m.id, m])));
    divMc.textContent = `Posições: ${(c.holdings || []).length} · Transações: ${(c.transactions || []).length} · Total: ${formatarReais(r.total)}`;
    body.appendChild(divMc);

    const divDate = document.createElement('div');
    divDate.className = 'marketcap';
    divDate.textContent = `Criada em: ${c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '—'}`;
    body.appendChild(divDate);

    li.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-ghost btn-small';
    btnEdit.textContent = 'Editar (PUT)';
    btnEdit.onclick = () => abrirEdicao(c);

    const btnBonus = document.createElement('button');
    btnBonus.className = 'btn btn-primary btn-small';
    btnBonus.textContent = '+R$ 1000 (PATCH)';
    btnBonus.onclick = () => somarSaldo(c);

    const btnDetails = document.createElement('button');
    btnDetails.className = 'btn btn-ghost btn-small';
    btnDetails.textContent = 'Ver ativos & Swap';
    btnDetails.onclick = () => abrirVisualizador(c);

    const btnBuy = document.createElement('button');
    btnBuy.className = 'btn btn-primary btn-small';
    btnBuy.textContent = 'Comprar';
    btnBuy.onclick = () => abrirCompra(c);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sell btn-small';
    btnDel.textContent = 'Excluir';
    btnDel.onclick = () => excluir(c._id);

    actions.append(btnEdit, btnBonus, btnDetails, btnBuy, btnDel);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

function abrirCriacao() {
  dialogModo = 'create';
  carteiraOriginal = null;
  titleEl.textContent = 'Nova carteira (POST)';
  $('w-id').value = `carteira-${Math.random().toString(36).slice(2, 8)}`;
  $('w-id').disabled = false;
  $('w-balance').value = '10000';
  errorEl.textContent = '';
  dialog.showModal();
}

function abrirEdicao(c) {
  dialogModo = 'edit';
  carteiraOriginal = c;
  titleEl.textContent = `Editar ${c._id} (PUT)`;
  $('w-id').value = c._id;
  $('w-id').disabled = true;
  $('w-balance').value = c.balance ?? 0;
  errorEl.textContent = '';
  dialog.showModal();
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

form.onsubmit = async (e) => {
  e.preventDefault();
  const id = $('w-id').value.trim();
  const balance = Number($('w-balance').value);
  if (!id) {
    errorEl.textContent = 'Informe o ID da carteira.';
    return;
  }
  if (!Number.isFinite(balance) || balance < 0) {
    errorEl.textContent = 'Saldo inválido.';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  errorEl.textContent = '';

  try {
    if (dialogModo === 'create') {
      const nova = {
        _id: id,
        balance,
        holdings: [],
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      const res = await api.criarCarteira(nova);
      avisar(`Carteira criada (POST ${res.status}).`);
    } else {
      const atualizada = {
        ...carteiraOriginal,
        balance,
      };
      await api.salvarCarteira(atualizada);
      avisar(`Carteira salva (PUT 200/201).`);
    }
    dialog.close();
    await carregar();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
};

$('btn-nova-carteira').onclick = abrirCriacao;
$('btn-recarregar').onclick = carregar;
$('wallet-cancel').onclick = () => dialog.close();

// ---------- Compra simulada ----------
let compra = null; // { carteiraId, carteira }
const buyDialog = $('buy-dialog');
const buyForm = $('buy-form');
const buyMoeda = $('buy-moeda');
const buyValor = $('buy-valor');
const buyInfo = $('buy-info');
const buyPreview = $('buy-preview');
const buyError = $('buy-error');
const buyConfirm = $('buy-confirm');

function abrirCompra(c) {
  if (moedas.length === 0) {
    avisar('Nenhum criptoativo no banco. Importe as moedas na página principal primeiro.', true);
    return;
  }
  compra = { carteiraId: c._id, carteira: c };
  buyError.textContent = '';
  buyValor.value = '';
  buyPreview.textContent = '';
  $('buy-title').textContent = `Comprar com ${c._id}`;
  buyInfo.textContent = `Saldo disponível: ${formatarReais(c.balance)}`;
  buyMoeda.textContent = '';
  moedas.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.symbol}) - ${formatarReais(m.price)}`;
    buyMoeda.appendChild(opt);
  });
  atualizarPreviewCompra();
  buyDialog.showModal();
  buyValor.focus();
}

function atualizarPreviewCompra() {
  if (!compra) return;
  const moeda = moedas.find((m) => m.id === buyMoeda.value);
  const valor = Number(buyValor.value);
  if (!moeda || !(valor > 0)) {
    buyPreview.textContent = '';
    return;
  }
  buyPreview.textContent = `Você vai receber cerca de ${formatarQuantidade(valor / moeda.price)} ${moeda.symbol}.`;
}

buyMoeda.onchange = atualizarPreviewCompra;
buyValor.oninput = () => { buyError.textContent = ''; atualizarPreviewCompra(); };
$('buy-cancel').onclick = () => buyDialog.close();
buyDialog.addEventListener('close', () => { compra = null; });

buyForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!compra) return;
  const moeda = moedas.find((m) => m.id === buyMoeda.value);
  try {
    const resultado = comprar(compra.carteira, moeda, buyValor.value);
    buyConfirm.disabled = true;
    await api.salvarCarteira(resultado.carteira);
    buyDialog.close();
    await carregar();
    avisar(`Pronto! Comprou ${formatarQuantidade(resultado.quantidade)} ${moeda.symbol} por ${formatarReais(resultado.total)}.`);
  } catch (err) {
    buyError.textContent = err.message;
  } finally {
    buyConfirm.disabled = false;
  }
};

// ---------- Visualizador de ativos, Venda e Swap ----------
let visualizadorCarteira = null;

const detailsDialog = $('wallet-details-dialog');
const detailsTitle = $('details-title');
const detailsSummary = $('details-summary');
const detailsHoldings = $('details-holdings');
const swapForm = $('swap-form');
const swapFrom = $('swap-from');
const swapTo = $('swap-to');
const swapAmount = $('swap-amount');
const swapPreview = $('swap-preview');
const swapError = $('swap-error');
const swapConfirm = $('swap-confirm');

function abrirVisualizador(c) {
  visualizadorCarteira = c;
  renderizarVisualizador();
  detailsDialog.showModal();
}

function renderizarVisualizador() {
  if (!visualizadorCarteira) return;
  const c = visualizadorCarteira;
  const mapa = new Map(moedas.map((m) => [m.id, m]));
  const r = resumir(c, mapa);

  detailsTitle.textContent = `Ativos da carteira: ${c._id}`;

  detailsSummary.textContent = '';
  const statsDiv = document.createElement('div');
  statsDiv.className = 'stats';
  const mk = (label, value) => {
    const s = document.createElement('div');
    s.className = 'stat';
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'value';
    v.textContent = value;
    s.append(l, v);
    return s;
  };
  statsDiv.append(
    mk('Disponível (BRL)', formatarReais(c.balance)),
    mk('Valor em Cripto', formatarReais(r.valorAtual)),
    mk('Total Geral', formatarReais(r.total)),
  );
  detailsSummary.appendChild(statsDiv);

  detailsHoldings.textContent = '';
  if (r.posicoes.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Nenhum criptoativo nesta carteira.';
    detailsHoldings.appendChild(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'holdings';
    r.posicoes.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'holding';

      const info = document.createElement('div');
      info.className = 'info';
      const strong = document.createElement('strong');
      strong.textContent = `${p.name} (${p.symbol})`;
      const span = document.createElement('span');
      span.textContent = `${formatarQuantidade(p.amount)} ${p.symbol} · Preço médio: ${formatarReais(p.avgPrice)} · Atual: ${formatarReais(p.precoAtual)}`;
      info.append(strong, span);

      const res = document.createElement('div');
      res.className = 'result';
      const divVal = document.createElement('div');
      divVal.textContent = formatarReais(p.valor);
      const divLucro = document.createElement('div');
      divLucro.className = p.lucro >= 0 ? 'positive-text' : 'negative-text';
      divLucro.textContent = `${p.lucro >= 0 ? '+' : ''}${formatarReais(p.lucro)} (${p.lucroPct.toFixed(2)}%)`;
      res.append(divVal, divLucro);

      const btnVender = document.createElement('button');
      btnVender.className = 'btn btn-sell btn-small';
      btnVender.textContent = 'Vender 100%';
      btnVender.onclick = async () => {
        try {
          const moedaObj = mapa.get(p.cryptoId);
          const resVenda = vender(visualizadorCarteira, moedaObj, p.amount);
          await api.salvarCarteira(resVenda.carteira);
          visualizadorCarteira = resVenda.carteira;
          await carregar();
          renderizarVisualizador();
          avisar(`Vendido ${formatarQuantidade(p.amount)} ${p.symbol} por ${formatarReais(resVenda.total)}.`);
        } catch (err) {
          avisar(err.message, true);
        }
      };

      li.append(info, res, btnVender);
      ul.appendChild(li);
    });
    detailsHoldings.appendChild(ul);
  }

  // Preencher selects do Swap
  swapFrom.textContent = '';
  const optBrl = document.createElement('option');
  optBrl.value = 'BRL';
  optBrl.textContent = `BRL (Saldo: ${formatarReais(c.balance)})`;
  swapFrom.appendChild(optBrl);
  c.holdings.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h.cryptoId;
    opt.textContent = `${h.symbol} (Qtd: ${formatarQuantidade(h.amount)})`;
    swapFrom.appendChild(opt);
  });

  swapTo.textContent = '';
  moedas.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.symbol}) - ${formatarReais(m.price)}`;
    swapTo.appendChild(opt);
  });
  atualizarPreviewSwap();
}

function atualizarPreviewSwap() {
  if (!visualizadorCarteira) return;
  const fromId = swapFrom.value;
  const toId = swapTo.value;
  const qtd = Number(swapAmount.value);
  if (!(qtd > 0) || fromId === toId) {
    swapPreview.textContent = '';
    return;
  }
  const mapa = new Map(moedas.map((m) => [m.id, m]));
  const destino = mapa.get(toId);
  if (!destino) return;

  if (fromId === 'BRL') {
    if (qtd > visualizadorCarteira.balance) {
      swapPreview.textContent = 'Saldo em BRL insuficiente.';
      return;
    }
    const rec = qtd / destino.price;
    swapPreview.textContent = `Investindo ${formatarReais(qtd)} você receberá ~${formatarQuantidade(rec)} ${destino.symbol}.`;
  } else {
    const holding = visualizadorCarteira.holdings.find((h) => h.cryptoId === fromId);
    const origem = mapa.get(fromId);
    if (!holding || !origem) return;
    if (qtd > holding.amount) {
      swapPreview.textContent = `Quantidade de ${origem.symbol} excede o que você possui.`;
      return;
    }
    const valorBrl = qtd * origem.price;
    const rec = valorBrl / destino.price;
    swapPreview.textContent = `Trocando ${formatarQuantidade(qtd)} ${origem.symbol} (~${formatarReais(valorBrl)}) por ~${formatarQuantidade(rec)} ${destino.symbol}.`;
  }
}

swapFrom.onchange = atualizarPreviewSwap;
swapTo.onchange = atualizarPreviewSwap;
swapAmount.oninput = () => { swapError.textContent = ''; atualizarPreviewSwap(); };

swapForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!visualizadorCarteira) return;
  const fromId = swapFrom.value;
  const toId = swapTo.value;
  const qtd = Number(swapAmount.value);
  if (fromId === toId) {
    swapError.textContent = 'A origem e o destino devem ser diferentes.';
    return;
  }
  if (!(qtd > 0)) {
    swapError.textContent = 'Informe uma quantidade válida.';
    return;
  }

  const mapa = new Map(moedas.map((m) => [m.id, m]));
  const destino = mapa.get(toId);

  try {
    let tempCarteira = structuredClone(visualizadorCarteira);
    if (fromId === 'BRL') {
      const resCompra = comprar(tempCarteira, destino, qtd);
      tempCarteira = resCompra.carteira;
    } else {
      const origem = mapa.get(fromId);
      const resVenda = vender(tempCarteira, origem, qtd);
      const resCompra = comprar(resVenda.carteira, destino, resVenda.total);
      tempCarteira = resCompra.carteira;
    }

    swapConfirm.disabled = true;
    await api.salvarCarteira(tempCarteira);
    visualizadorCarteira = tempCarteira;
    await carregar();
    renderizarVisualizador();
    swapAmount.value = '';
    avisar('Swap realizado com sucesso!');
  } catch (err) {
    swapError.textContent = err.message;
  } finally {
    swapConfirm.disabled = false;
  }
};

$('details-close').onclick = () => detailsDialog.close();
detailsDialog.addEventListener('close', () => { visualizadorCarteira = null; });

carregar();
