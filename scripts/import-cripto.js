#!/usr/bin/env node
// Alternativa por terminal ao botão "Importar da CoinGecko" do site.
// Uso: npm run import   (com o docker compose rodando)
import { importarMoedas, URL_MOEDAS } from '../frontend/api.js';

try {
  const { criadas, atualizadas } = await importarMoedas((feitas, total) => {
    process.stdout.write(`\rSalvando ${feitas}/${total}...`);
  });
  console.log(`\nPronto! ${criadas} moedas novas (POST) e ${atualizadas} atualizadas (PATCH) em ${URL_MOEDAS}`);
} catch (err) {
  console.error('\nErro:', err.message);
  process.exit(1);
}
