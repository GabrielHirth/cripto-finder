

const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function calcularIndicadores(moedas) {
  const total = moedas.length;
  const notas = moedas.filter((m) => m.nota != null).map((m) => m.nota);
  const porAlta = [...moedas].sort((a, b) => b.change24h - a.change24h);
  return {
    total,
    capTotal: moedas.reduce((s, m) => s + m.marketCap, 0),
    mediaVariacao: media(moedas.map((m) => m.change24h)),
    maiorAlta: porAlta[0] ? { nome: porAlta[0].name, valor: porAlta[0].change24h } : null,
    pctEmAlta: total ? (moedas.filter((m) => m.change24h > 0).length / total) * 100 : 0,
    favoritas: moedas.filter((m) => m.favorito).length,
    notaMedia: notas.length ? media(notas) : null,
  };
}


export function rankingPor(moedas, chave, n) {
  return [...moedas].sort((a, b) => b[chave] - a[chave]).slice(0, n);
}


export const FAIXAS = [
  'Alta forte (5% ou mais)',
  'Alta leve (0% a 5%)',
  'Queda leve (0% a -5%)',
  'Queda forte (-5% ou menos)',
];

export function agruparPorTendencia(moedas) {
  const qtd = [0, 0, 0, 0];
  for (const m of moedas) {
    const v = m.change24h;
    qtd[v >= 5 ? 0 : v >= 0 ? 1 : v > -5 ? 2 : 3] += 1;
  }
  return FAIXAS.map((rotulo, i) => ({ rotulo, qtd: qtd[i] }));
}
