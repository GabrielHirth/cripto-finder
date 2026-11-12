# Cripto Finder

Atividade prática — Consumo de APIs NoSQL com HTTP e Frontend (Engenharia de Software · Banco de Dados).

**Tema:** Criptomoedas · **API de origem:** [CoinGecko](https://www.coingecko.com/en/api) (`/api/v3/coins/markets?vs_currency=brl`) · **Banco:** MongoDB 7 + RESTHeart 8, tudo em Docker.

## Integrantes e papéis

| Integrante | Papel principal |
|---|---|
| _(preencher)_ | Dados (modelagem e banco no Docker) |
| _(preencher)_ | API (requisições HTTP e testes no Postman) |
| _(preencher)_ | Interface (frontend e gráficos) |

## Como rodar

Pré-requisito: Docker Desktop (ou Docker Engine) instalado.

```bash
docker compose up -d      # sobe MongoDB + RESTHeart + frontend (nginx)
docker compose ps         # os 3 serviços devem estar "running"
```

Abra **http://localhost:3000**. Na primeira visita o site cria sozinho as coleções e a
carteira, e (com o banco vazio) **importa as 30 maiores moedas** da CoinGecko. Nenhum passo manual é necessário.
Se a CoinGecko estiver limitando as requisições (HTTP 429), espere 1 minuto e clique em
**Importar / atualizar da CoinGecko**.

| Ação | Comando |
|---|---|
| Ver erros do banco/API | `docker compose logs -f restheart` |
| Parar (mantém os dados) | `docker compose down` |
| Parar e **apagar os dados** | `docker compose down -v` |

Porta 8080 ou 3000 ocupada? Troque só o número da esquerda no `docker-compose.yml` (ex.: `"8081:8080"`) e a
constante `API_BASE` em `frontend/api.js`.

### Alternativas para desenvolvedores

```bash
npm install
npm run import   # importa pelo terminal (Node 18+), igual ao botão do site
npm start        # frontend em http://localhost:3000 sem nginx (não rode junto com o container frontend)
npm test         # regras da carteira, validação, painel e API (com um RESTHeart de mentirinha)
```

O usuário `admin` / senha `secret` é o padrão do RESTHeart e só é aceitável porque o banco roda na máquina
local. Nenhuma outra senha ou chave está no repositório.

## Modelagem NoSQL

Duas coleções (no RESTHeart padrão a raiz `/` já é o banco `restheart`, então a coleção é o 1º trecho da URL):

- **`cripto-finder`** — 30+ moedas importadas da CoinGecko (mais as criadas pelo formulário).
- **`wallets`** — a carteira simulada de cada navegador.

### Exemplo de documento (`cripto-finder`)

```json
{
  "_id": "bitcoin",
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "image": "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
  "current_price": 600000,
  "market_cap": 12000000000000,
  "market_cap_rank": 1,
  "price_change_percentage_24h": 2.5,
  "total_volume": 30000000000,
  "ath_date": "2025-10-06T18:57:42.558Z",
  "roi": null,
  "favorito": false,
  "nota": null,
  "comentario": "",
  "tags": [],
  "origem": "coingecko",
  "criadoEm": "2026-11-08T10:00:00.000Z",
  "atualizadoEm": "2026-11-08T10:00:00.000Z"
}
```

- **Veio da API:** `id`, `symbol`, `name`, `image`, preços, `market_cap`, `ath_date`, `roi`...
- **Criados pelo grupo (não existem na API):** `favorito`, `nota` (0 a 10), `comentario`, `tags`, `origem`, `criadoEm`, `atualizadoEm`.
- **Tipos exigidos:** números (`current_price`), datas (`criadoEm`, `ath_date`), lista embutida (`tags`) e objeto embutido (`roi`).

### Exemplo de documento (`wallets`)

```json
{
  "_id": "carteira-1a2b3c4d",
  "balance": 9000,
  "holdings": [
    { "cryptoId": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "amount": 0.01, "avgPrice": 100000 }
  ],
  "transactions": [
    { "type": "buy", "cryptoId": "bitcoin", "symbol": "BTC", "amount": 0.01, "price": 100000, "total": 1000, "date": "2026-11-08T10:00:00Z" }
  ],
  "createdAt": "2026-11-08T10:00:00Z"
}
```

### Embutido x referenciado

- **Embutido:** `holdings` e `transactions` ficam **dentro** da carteira. Só fazem sentido para aquela carteira, são
  sempre lidos junto com ela e o histórico é limitado a 50 operações, então não crescem sem limite. Uma única
  leitura (GET) traz tudo. Do mesmo modo, `tags` fica dentro da moeda.
- **Referenciado:** a carteira guarda só o `cryptoId` da moeda, **não** uma cópia dela. O preço muda toda hora e
  vive em um lugar só (`cripto-finder`); a carteira consulta o preço atual por esse id e calcula ganho ou perda.
  Assim, atualizar os preços na coleção de moedas atualiza todas as carteiras sem reescrevê-las.

## Endpoints (RESTHeart, em `http://localhost:8080`)

Todos usam autenticação Basic. Coleção de moedas: `/cripto-finder`.

| Ação | Método e URL | Status esperado |
|---|---|---|
| Criar coleção | `PUT /cripto-finder` | 201 Created (200 se já existe) |
| Inserir moeda | `POST /cripto-finder` | 201 Created (id no cabeçalho `Location`) |
| Listar moedas | `GET /cripto-finder?pagesize=100` | 200 OK |
| Buscar uma moeda | `GET /cripto-finder/{id}` | 200 OK ou 404 Not Found |
| Substituir moeda (formulário de edição) | `PUT /cripto-finder/{id}` | 200 OK |
| Alterar campos (favoritar) | `PATCH /cripto-finder/{id}` | 200 OK |
| Excluir moeda (com confirmação) | `DELETE /cripto-finder/{id}` | 204 No Content |
| Ler carteira | `GET /wallets/{id}` | 200 OK ou 404 |
| Salvar carteira (comprar, vender, zerar) | `PUT /wallets/{id}` | 200 OK (201 na criação) |

Sem o cabeçalho `Authorization`, qualquer rota responde **401 Unauthorized**.

A coleção do Postman/Insomnia está em [`postman/colecao.json`](postman/colecao.json): importe e rode as requisições
1 a 9 na ordem (inclui a origem CoinGecko, os cinco métodos e os testes de status).

## O que o site faz

- **Importar:** `GET` na CoinGecko e `POST` de cada moeda no banco. Rodar de novo atualiza os preços com `PATCH`
  e preserva favorito, nota e comentário.
- **Listagem** com busca por nome/símbolo e filtros (só favoritas / top 10 por valor de mercado / variação positiva ou negativa).
- **Formulário** de criar e editar com validação por campo; mensagens de carregamento, sucesso e erro, sempre com o
  status HTTP quando algo falha; layout responsivo para celular.
- **Painel** (recalculado do banco depois de todo POST, PUT, PATCH ou DELETE): 7 indicadores, 2 gráficos
  (barras e pizza, Chart.js), ranking das 5 maiores altas em 24 h e agrupamento por tendência.
- **Carteira virtual** com R$ 10.000 fictícios: comprar, vender, ganho/perda sobre o preço médio, histórico e recomeçar.

As regras ficam em `frontend/wallet-logic.js`, `documento.js` e `dashboard-logic.js` (testadas em `tests/`); a
comunicação HTTP fica em `frontend/api.js` e a tela em `frontend/app.js`.

## Prints do painel

_(inserir aqui os prints: painel completo, formulário de edição, versão no celular)_

## Conclusão tirada dos dados

_(reescrever com os números reais do painel no dia da entrega. Modelo:)_ Entre as 30 maiores moedas em reais,
X% estavam em alta nas últimas 24 h e a variação média foi de Y%. O valor de mercado é muito concentrado: as 3
maiores respondem por Z% do total do top 30, enquanto a maioria das moedas fica na faixa "queda leve/alta leve".
Isso mostra que o mercado se move em bloco e que o ranking por valor de mercado muda pouco de um dia para o outro,
ao contrário da variação diária, que é bem mais volátil.

## Uso de IA

_(descrever onde a IA foi usada, conforme a regra da atividade; todo o grupo deve saber explicar qualquer linha do código.)_

## Estrutura

```
cripto-finder/
├── docker-compose.yml        # MongoDB + RESTHeart + frontend (nginx)
├── frontend/
│   ├── index.html  style.css  app.js
│   ├── api.js                # todas as requisições HTTP
│   ├── documento.js          # modelo, validação e montagem dos documentos
│   ├── dashboard-logic.js    # indicadores, ranking, agrupamento
│   └── wallet-logic.js       # regras da carteira
├── scripts/import-cripto.js  # importação pelo terminal
├── tests/                    # npm test
├── postman/colecao.json
└── README.md
```

## Licença

MIT
