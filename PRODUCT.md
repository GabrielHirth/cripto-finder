# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Docker (MongoDB 7 + RESTHeart 8) backend, static HTML/JS frontend served via nginx (or http-server), vanilla JS with ES modules.

## Users

Estudantes de Engenharia de Software e Banco de Dados realizando atividade prática de consumo de APIs NoSQL com HTTP e Frontend.

## Product Purpose

Cripto Finder é um painel e carteira simulada de criptomoedas integrado à API da CoinGecko e a um banco NoSQL (MongoDB/RESTHeart via Docker), servindo para praticar operações CRUD, modelagem embutida vs referenciada e requisições HTTP authenticadas.

## Positioning

Uma aplicação didática completa e autocontida que demonstra o ciclo de vida completo de dados NoSQL (importação, indicadores, gráficos, simulação de carteira com CRUD, compra, venda e swap) rodando localmente via Docker.

## Operating Context

Ambiente local de desenvolvimento (Docker Desktop / Docker Engine) com containers para MongoDB, RESTHeart e nginx, além de testes automatizados com Node.js (`node --test`).

## Capabilities and Constraints

- Funcionalidades: Importação CoinGecko, listagem com filtros e busca, formulários de criação e edição com validação, painel com indicadores e gráficos (Chart.js), carteira simulada com saldo fictício, histórico, visualizador de ativos e troca (swap).
- Restrições: Autenticação Basic Auth padrão (`admin:secret`) exigida pelo RESTHeart local.

## Brand Commitments

Nome: Cripto Finder. Identidade didática, limpa e funcional em HTML/CSS/JS puro com módulos ES.

## Evidence on Hand

- Código-fonte completo em `frontend/` (`index.html`, `carteira.html`, `app.js`, `carteira-page.js`, `api.js`, `wallet-logic.js`, `documento.js`, `dashboard-logic.js`).
- Testes automatizados em `tests/`.
- Documentação em `README.md`.

## Product Principles

1. **Simplicidade e Clareza:** Código modular sem frameworks pesados, fácil de auditar e entender por estudantes.
2. **Resiliência Local:** Tudo roda via Docker de forma autocontida na máquina do usuário, sem dependências externas ocultas.
3. **Fidelidade aos Padrões REST:** Uso correto dos métodos HTTP (GET, POST, PUT, PATCH, DELETE) e status codes correspondentes.
4. **Verificabilidade:** Testes unitários e de integração cobrindo lógica de negócio e cliente HTTP.

## Accessibility & Inclusion

Interface web limpa, responsiva (mobile-friendly), com contrastes adequados e textos alternativos/rótulos em formulários.
