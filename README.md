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

## Endpoints principais (RestHeart)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/crypto` | Lista criptomoedas |
| GET | `/crypto/{id}` | Detalhes de uma moeda |
| GET | `/crypto?sort=-marketCap` | Ranking por market cap |
| GET | `/crypto?sort=-change24h` | Ranking por variação 24h |
| POST | `/wallet` | Criar carteira simulada |
| GET | `/wallet/{id}` | Ver carteira |
| POST | `/wallet/{id}/buy` | Comprar moeda |
| POST | `/wallet/{id}/sell` | Vender moeda |

## Modelos de dados

### Crypto
```json
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

### Wallet (simulada)
```json
{
  "_id": "wallet-1",
  "balance": 10000,
  "holdings": [
    { "cryptoId": "bitcoin", "amount": 0.1, "avgPrice": 60000 }
  ],
  "createdAt": "2026-10-19T10:00:00Z"
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