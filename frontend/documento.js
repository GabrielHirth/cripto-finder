// Regras do documento "moeda": criar, validar e montar o JSON que vai para o banco.
// Funções puras (sem tela e sem rede), por isso dá para testar com `npm test`.

// O RESTHeart devolve _id como string (quando nós definimos) ou como { "$oid": "..." }.
export function idString(v) {
  if (v && typeof v === 'object' && v.$oid) return v.$oid;
  return v == null ? '' : String(v);
}

export function slug(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Documento vindo do CoinGecko + campos que só existem no nosso grupo.
// `tags` é uma lista embutida; `roi` (do CoinGecko) é um objeto embutido.
export function enriquecer(coin, agora = new Date()) {
  const iso = agora.toISOString();
  return {
    ...coin,
    _id: coin.id,
    favorito: false,
    nota: null,
    comentario: '',
    tags: [],
    origem: 'coingecko',
    criadoEm: iso,
    atualizadoEm: iso,
  };
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));

export function validarFormulario(v, { idsOcupados } = {}) {
  const erros = {};
  const nome = String(v.name || '').trim();
  if (nome.length < 2 || nome.length > 60) erros.name = 'Informe o nome (2 a 60 letras).';
  else if (idsOcupados?.has(slug(nome))) erros.name = 'Já existe uma moeda com esse nome.';

  if (!/^[A-Za-z0-9]{1,10}$/.test(String(v.symbol || '').trim())) {
    erros.symbol = 'Símbolo com 1 a 10 letras ou números, sem espaços.';
  }
  if (!(num(v.price) > 0)) erros.price = 'Informe um preço maior que zero.';
  if (!(num(v.marketCap) >= 0)) erros.marketCap = 'Informe o valor de mercado (zero ou mais).';
  const variacao = num(v.change24h);
  if (!Number.isFinite(variacao) || variacao < -100 || variacao > 100000) {
    erros.change24h = 'Informe a variação em % (não pode ser menor que -100).';
  }
  if (v.nota !== '' && v.nota != null) {
    const n = num(v.nota);
    if (!Number.isInteger(n) || n < 0 || n > 10) erros.nota = 'A nota é um número inteiro de 0 a 10.';
  }
  if (String(v.comentario || '').length > 300) erros.comentario = 'Máximo de 300 caracteres.';
  const tags = lerTags(v.tags);
  if (tags.length > 5 || tags.some((t) => t.length > 20)) {
    erros.tags = 'Até 5 tags, cada uma com no máximo 20 letras, separadas por vírgula.';
  }
  return { valido: Object.keys(erros).length === 0, erros };
}

export function lerTags(texto) {
  return String(texto || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function camposDoFormulario(v, iso) {
  return {
    name: String(v.name).trim(),
    symbol: String(v.symbol).trim().toLowerCase(),
    current_price: Number(v.price),
    market_cap: Number(v.marketCap),
    price_change_percentage_24h: Number(v.change24h),
    favorito: Boolean(v.favorito),
    nota: v.nota === '' || v.nota == null ? null : Number(v.nota),
    comentario: String(v.comentario || '').trim(),
    tags: lerTags(v.tags),
    atualizadoEm: iso,
  };
}

// POST: documento novo, criado pelo formulário (o _id é gerado pelo banco).
export function montarNovo(v, agora = new Date()) {
  const iso = agora.toISOString();
  return {
    id: slug(v.name),
    image: '',
    market_cap_rank: null,
    total_volume: 0,
    roi: null,
    origem: 'manual',
    criadoEm: iso,
    ...camposDoFormulario(v, iso),
  };
}

// PUT: documento inteiro. Parte do que veio do banco, para não perder nenhum campo.
export function montarSubstituicao(original, v, agora = new Date()) {
  // eslint-disable-next-line no-unused-vars
  const { _id, _etag, _links, ...resto } = original;
  return { ...resto, ...camposDoFormulario(v, agora.toISOString()) };
}

// Valores iniciais do formulário de edição.
export function valoresDoDocumento(doc) {
  return {
    name: doc.name ?? '',
    symbol: String(doc.symbol ?? '').toUpperCase(),
    price: doc.current_price ?? doc.price ?? '',
    marketCap: doc.market_cap ?? doc.marketCap ?? '',
    change24h: doc.price_change_percentage_24h ?? doc.change24h ?? 0,
    nota: doc.nota === '' || doc.nota == null ? '' : doc.nota,
    comentario: doc.comentario ?? '',
    tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : '',
    favorito: Boolean(doc.favorito),
  };
}
