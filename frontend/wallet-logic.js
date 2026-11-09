// Regras da carteira virtual (simulada). Funções puras: não mexem na tela nem na API,
// por isso dá para testar com `npm test`.

export const SALDO_INICIAL = 10000;
const LIMITE_HISTORICO = 50;
const TOLERANCIA = 1e-10;

export class ErroCarteira extends Error {}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatarReais = (n) => brl.format(n || 0);
export const formatarQuantidade = (n) =>
  (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 });

// O banco pode ter moedas no formato do CoinGecko (current_price, market_cap...)
// ou no formato simples do README (price, marketCap...). Aqui juntamos os dois.
export function normalizarMoeda(doc) {
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

export function novaCarteira(id, agora = new Date()) {
  return {
    _id: id,
    balance: SALDO_INICIAL,
    holdings: [],
    transactions: [],
    createdAt: agora.toISOString(),
  };
}

function validarPreco(moeda) {
  if (!(moeda.price > 0)) {
    throw new ErroCarteira(`Ainda não temos o preço de ${moeda.name || 'essa moeda'}. Tente atualizar a página.`);
  }
}

function registrar(carteira, tipo, moeda, quantidade, total, agora) {
  carteira.transactions.unshift({
    type: tipo,
    cryptoId: moeda.id,
    symbol: moeda.symbol,
    amount: quantidade,
    price: moeda.price,
    total,
    date: agora.toISOString(),
  });
  carteira.transactions = carteira.transactions.slice(0, LIMITE_HISTORICO);
}

// Compra informando quanto o usuário quer gastar em reais.
export function comprar(carteira, moeda, valor, agora = new Date()) {
  validarPreco(moeda);
  valor = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroCarteira('Digite quanto você quer investir, por exemplo 100.');
  }
  if (valor > carteira.balance + TOLERANCIA) {
    throw new ErroCarteira(
      `Você não tem saldo suficiente para isso. Seu saldo é ${formatarReais(carteira.balance)}.`
    );
  }

  const nova = structuredClone(carteira);
  const quantidade = valor / moeda.price;
  nova.balance = Math.round((nova.balance - valor) * 100) / 100;

  const posicao = nova.holdings.find((h) => h.cryptoId === moeda.id);
  if (posicao) {
    const totalAntes = posicao.amount * posicao.avgPrice;
    posicao.amount += quantidade;
    posicao.avgPrice = (totalAntes + valor) / posicao.amount;
  } else {
    nova.holdings.push({
      cryptoId: moeda.id,
      symbol: moeda.symbol,
      name: moeda.name,
      amount: quantidade,
      avgPrice: moeda.price,
    });
  }
  registrar(nova, 'buy', moeda, quantidade, valor, agora);
  return { carteira: nova, quantidade, total: valor };
}

// Venda informando a quantidade de moedas (a tela converte de reais para quantidade).
export function vender(carteira, moeda, quantidade, agora = new Date()) {
  validarPreco(moeda);
  quantidade = Number(quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new ErroCarteira('Digite quanto você quer vender.');
  }
  const posicao = carteira.holdings.find((h) => h.cryptoId === moeda.id);
  if (!posicao || posicao.amount <= TOLERANCIA) {
    throw new ErroCarteira(`Você ainda não tem ${moeda.name || 'essa moeda'} na carteira.`);
  }
  if (quantidade > posicao.amount + TOLERANCIA) {
    throw new ErroCarteira(
      `Você só tem ${formatarQuantidade(posicao.amount)} ${moeda.symbol} para vender.`
    );
  }

  const nova = structuredClone(carteira);
  const alvo = nova.holdings.find((h) => h.cryptoId === moeda.id);
  quantidade = Math.min(quantidade, alvo.amount);
  const total = Math.round(quantidade * moeda.price * 100) / 100;

  alvo.amount -= quantidade;
  if (alvo.amount <= TOLERANCIA) {
    nova.holdings = nova.holdings.filter((h) => h.cryptoId !== moeda.id);
  }
  nova.balance = Math.round((nova.balance + total) * 100) / 100;
  registrar(nova, 'sell', moeda, quantidade, total, agora);
  return { carteira: nova, quantidade, total };
}

// Números para o painel: quanto está investido, quanto vale hoje e o resultado.
export function resumir(carteira, moedasPorId) {
  let investido = 0;
  let valorAtual = 0;
  const posicoes = carteira.holdings.map((h) => {
    const moeda = moedasPorId.get(h.cryptoId);
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
