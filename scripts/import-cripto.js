#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'fs';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const URL_CRIPTO = `${API_BASE}/cripto`;
const AUTORIZACAO = 'Basic ' + Buffer.from(process.env.RH_AUTH || 'admin:secret').toString('base64');

async function fetchCoinGecko() {
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'brl');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', '30');
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
  return response.json();
}

const aguardar = (ms) => new Promise((r) => setTimeout(r, ms));

async function lerErro(r) {
  try { return (await r.text()).slice(0, 300); } catch { return ''; }
}

async function criarColecao(url) {
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    const r = await fetch(url, { method: 'PUT', headers: { Authorization: AUTORIZACAO } });
    if (r.status === 401) throw new Error('RestHeart recusou o usuário/senha (401). Confira RH_AUTH ou a senha do admin.');
    if (r.ok) return;
    if (tentativa === 6) {
      throw new Error(`Não consegui criar ${url} (status ${r.status}). ${await lerErro(r)}`);
    }
    await aguardar(1000);
  }
}

async function enviarParaApi(docs) {
  await criarColecao(URL_CRIPTO);
  console.log(`Coleção ${URL_CRIPTO} pronta`);

  const r = await fetch(URL_CRIPTO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: AUTORIZACAO },
    body: JSON.stringify(docs),
  });
  if (!r.ok) {
    throw new Error(`RestHeart respondeu ${r.status} ao salvar as moedas. ${await lerErro(r)}`);
  }
}

async function main() {
  try {
    const data = await fetchCoinGecko();

    // Add group fields (not in CoinGecko)
    const enriched = data.map((doc) => ({
      ...doc,
      _id: doc.id,
      favorito: false,
      nota: '',
      comentario: '',
      atualizadoEm: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
      grupo: 'cripto-finder',
      versao: '1.0',
    }));
    console.log(`Buscamos ${enriched.length} moedas no CoinGecko`);

    // Save to /scripts/data/import-cripto.json for manual import
    const dir = new URL('./data/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('import-cripto.json', dir), JSON.stringify(enriched, null, 2), 'utf8');

    await enviarParaApi(enriched);
    console.log(`Pronto! ${enriched.length} moedas salvas em ${URL_CRIPTO}`);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

await main();
