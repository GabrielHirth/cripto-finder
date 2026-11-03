#!/usr/bin/env node

import { writeFileSync } from 'fs';

async function fetchCoinGecko() {
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'brl');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', '30');
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  return response.json();
}

async function main() {
  try {
    const data = await fetchCoinGecko();

    // Add group fields (not in CoinGecko)
    const enriched = data.map(doc => ({
      ...doc,
      favorito: false,
      nota: '',
      comentario: '',
      atualizadoEm: null,
      criadoEm: new Date().toISOString(),
      _grupo: 'cripto-finder',
      _version: '1.0'
    }));

    console.log(`Fetched ${enriched.length} from CoinGecko`);

    // Save to /scripts/data/import-cripto.json for manual import
    const jsonPath = new URL('./scripts/data/import-cripto.json', import.meta.url).pathname;
    writeFileSync(jsonPath, JSON.stringify(enriched, null, 2), 'utf8');
    console.log(`Saved to ${jsonPath}`);

    console.log('Next: push to RestHeart via API or import JSON directly');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

await main();