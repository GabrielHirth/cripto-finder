
export const SALDO_INICIAL = 10000;
const MAX_HISTORICO = 50;
const MARGEM = 1e-10;

export class ErroDeCarteira extends Error {}

const formatoReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const mostrarReais = (n) => formatoReais.format(n || 0);
export const mostrarQuantidade = (n) =>
  (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 });

export function ajustarMoeda(doc) {
  return {
    id: doc.id ?? doc._id,
    symbol: String(doc.symbol || '').toUpperCase(),
    name: doc.name || '',
    image: doc.image || '',
    price: Number(doc.current_price ?? doc.price ?? 0),
    marketCap: Number(doc.market_cap ?? doc.marketCap ?? 0),
    change24h: Number(doc.price_change_percentage_24h ?? doc.change24h ?? 0),
  };
}

export function criarCarteira(id, agora = new Date()) {
  return {
    _id: id,
    balance: SALDO_INICIAL,
    holdings: [],
    transactions: [],
    createdAt: agora.toISOString(),
  };
}

function checarPreco(moeda) {
  if (!(moeda.price > 0)) {
    throw new ErroDeCarteira(`Ainda não temos o preço de ${moeda.name || 'essa moeda'}. Tente atualizar a página.`);
  }
}

function guardarTransacao(carteira, tipo, moeda, quantidade, total, agora) {
  carteira.transactions.unshift({
    type: tipo,
    cryptoId: moeda.id,
    symbol: moeda.symbol,
    amount: quantidade,
    price: moeda.price,
    total,
    date: agora.toISOString(),
  });
  carteira.transactions = carteira.transactions.slice(0, MAX_HISTORICO);
}

export function comprar(carteira, moeda, valor, agora = new Date()) {
  checarPreco(moeda);
  valor = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroDeCarteira('Digite quanto você quer investir, por exemplo 100.');
  }
  if (valor > carteira.balance + MARGEM) {
    throw new ErroDeCarteira(
      `Você não tem saldo suficiente para isso. Seu saldo é ${mostrarReais(carteira.balance)}.`
    );
  }

  const copia = structuredClone(carteira);
  const quantidade = valor / moeda.price;
  copia.balance = Math.round((copia.balance - valor) * 100) / 100;

  const posicaoAtual = copia.holdings.find((h) => h.cryptoId === moeda.id);
  if (posicaoAtual) {
    const custoAnterior = posicaoAtual.amount * posicaoAtual.avgPrice;
    posicaoAtual.amount += quantidade;
    posicaoAtual.avgPrice = (custoAnterior + valor) / posicaoAtual.amount;
  } else {
    copia.holdings.push({
      cryptoId: moeda.id,
      symbol: moeda.symbol,
      name: moeda.name,
      amount: quantidade,
      avgPrice: moeda.price,
    });
  }
  guardarTransacao(copia, 'buy', moeda, quantidade, valor, agora);
  return { carteira: copia, quantidade, total: valor };
}

export function vender(carteira, moeda, quantidade, agora = new Date()) {
  checarPreco(moeda);
  quantidade = Number(quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new ErroDeCarteira('Digite quanto você quer vender.');
  }
  const posicaoAtual = carteira.holdings.find((h) => h.cryptoId === moeda.id);
  if (!posicaoAtual || posicaoAtual.amount <= MARGEM) {
    throw new ErroDeCarteira(`Você ainda não tem ${moeda.name || 'essa moeda'} na carteira.`);
  }
  if (quantidade > posicaoAtual.amount + MARGEM) {
    throw new ErroDeCarteira(
      `Você só tem ${mostrarQuantidade(posicaoAtual.amount)} ${moeda.symbol} para vender.`
    );
  }

  const copia = structuredClone(carteira);
  const posicaoVenda = copia.holdings.find((h) => h.cryptoId === moeda.id);
  quantidade = Math.min(quantidade, posicaoVenda.amount);
  const total = Math.round(quantidade * moeda.price * 100) / 100;

  posicaoVenda.amount -= quantidade;
  if (posicaoVenda.amount <= MARGEM) {
    copia.holdings = copia.holdings.filter((h) => h.cryptoId !== moeda.id);
  }
  copia.balance = Math.round((copia.balance + total) * 100) / 100;
  guardarTransacao(copia, 'sell', moeda, quantidade, total, agora);
  return { carteira: copia, quantidade, total };
}

export function calcularResumo(carteira, mapaMoedas) {
  let investido = 0;
  let valorAtual = 0;
  const posicoes = carteira.holdings.map((h) => {
    const moeda = mapaMoedas.get(h.cryptoId);
    const preco = moeda?.price > 0 ? moeda.price : h.avgPrice;
    const custo = h.amount * h.avgPrice;
    const valor = h.amount * preco;
    investido += custo;
    valorAtual += valor;
    return {
      ...h,
      image: moeda?.image || '',
      precoAtual: preco,
      custo,
      valor,
      lucro: valor - custo,
      lucroPct: custo > 0 ? ((valor - custo) / custo) * 100 : 0,
    };
  });
  const lucro = valorAtual - investido;
  return {
    saldo: carteira.balance,
    investido,
    valorAtual,
    lucro,
    lucroPct: investido > 0 ? (lucro / investido) * 100 : 0,
    total: carteira.balance + valorAtual,
    posicoes,
  };
}
