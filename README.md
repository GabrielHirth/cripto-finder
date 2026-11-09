# Cripto-Finder

API de criptomoedas com ranking por valor de mercado, variação 24h e carteira simulada.

## Stack

- **MongoDB 7** — armazenamento de dados
- **RestHeart 8** — API REST sobre MongoDB
- **Frontend** — HTML/JS/CSS vanilla (em `frontend/`)
- **Postman** — coleção de testes (em `postman/`)

## Subir o projeto

```bash
docker-compose up -d
```

Serviços expostos:

- MongoDB: `localhost:27017`
- RestHeart API: `http://localhost:8080`

## Estrutura

```
cripto-finder/
├── docker-compose.yml
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── postman/
│   └── colecao.json
└── README.md
```

## Como rodar

```bash
docker-compose up -d     # MongoDB + RestHeart
npm install
npm run import           # busca as moedas no CoinGecko e salva no banco
npm start                # abre o frontend em http://localhost:3000
npm test                 # testa as regras da carteira
```

## Carteira virtual

Ao abrir o site pela primeira vez, a carteira é criada sozinha com R$ 10.000 fictícios
(o id fica guardado no navegador). Dá para:

- **Comprar** informando quanto investir em reais (atalhos de 10%, 25%, 50% e tudo)
- **Vender** parte ou tudo, com atalhos de 25%, 50%, 75% e tudo
- Ver o **ganho ou perda** de cada moeda em relação ao preço médio de compra
- Consultar o **histórico** das últimas 50 operações
- **Recomeçar do zero**

As regras ficam em `frontend/carteira.js` (testadas em `tests/`). A tela e a
comunicação com a API ficam em `frontend/app.js`.

## Endpoints (RestHeart)

Os dados ficam no banco `restheart` (o padrão do docker), então a URL começa direto pela coleção.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/cripto?pagesize=100` | Lista criptomoedas |
| GET | `/cripto/{id}` | Detalhes de uma moeda |
| GET | `/wallet/{id}` | Ver carteira |
| PUT | `/wallet/{id}` | Criar ou atualizar carteira |

Comprar e vender são calculados no frontend e a carteira inteira é salva com PUT.

## Modelos de dados

### Wallet (simulada)
```json
{
  "_id": "carteira-1a2b3c4d",
  "balance": 9000,
  "holdings": [
    { "cryptoId": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "amount": 0.01, "avgPrice": 100000 }
  ],
  "transactions": [
    { "type": "buy", "cryptoId": "bitcoin", "symbol": "BTC", "amount": 0.01, "price": 100000, "total": 1000, "date": "2026-11-07T10:00:00Z" }
  ],
  "createdAt": "2026-11-07T10:00:00Z"
}
```

## Desenvolvimento

### Popular banco com dados de exemplo

```bash
# Via RestHeart CLI ou POSTman
POST http://localhost:8080/crypto
Content-Type: application/json

{
  "_id": "bitcoin",
  "symbol": "BTC",
  "name": "Bitcoin",
  "marketCap": 1200000000000,
  "price": 62000,
  "change24h": 2.5,
  "volume24h": 30000000000
}
```

### Frontend

Abrir `frontend/index.html` no navegador (servir via Live Server ou similar).

## Parar

```bash
docker-compose down
```

Limpar volumes:

```bash
docker-compose down -v
```

## Licença

MIT