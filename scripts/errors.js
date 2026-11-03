#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../../data/cripto-errors.json');

fs.writeFileSync(
  JSON_PATH,
  JSON.stringify(
    { cripto: ['Erro ao buscar criptomoedas'] },
    null,
    2
  ),
  'utf8'
);

console.log('Created', JSON_PATH);