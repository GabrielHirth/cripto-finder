# Design — Cripto Finder

<!-- impeccable:design-schema 1 -->

## World

**Trading Cockpit** — dark terminal financeiro. Fundo preto-azulado profundo, painéis como consoles de operador, acento verde-neon para altas/compras e vermelho para baixas/vendas. Dados numéricos sempre em fonte mono tabular.

## Color strategy

Committed: o verde-neon `#00e08a` carrega botões primários, variações positivas e tags; o vermelho `#ff4d6d` carrega vendas, erros e variações negativas. Fundo `#0a0e14`, superfícies `#11161f` / `#161d29`, bordas `#1e2635`.

## Typography

- Display/títulos e todos os dados numéricos: mono (`ui-monospace` stack) — measurement, não costume.
- Corpo: system sans stack.
- Rastreamento negativo leve em títulos (`-0.02em`), limites em maiúsculas com `letter-spacing: 0.08em` para rótulos de painel.

## Components

- `.item` — card de console: borda sutil, hover com elevação (`translateY(-2px)`).
- `.stat` — bloco de indicador dentro de painel escuro.
- `.btn-primary` — verde-neon sólido, texto escuro; `.btn-sell` — contorno vermelho; `.btn-ghost` — neutro.
- `.dialog` — painel flutuante com backdrop escuro + blur.
- `.toast` — canto inferior, mono, borda de status (vermelho em erro).
- Gráficos Chart.js: barras em `#00e08a`, pizza em verde/azul/âmbar/vermelho, ejes e legendas em `#8b98a9` sobre grid `#1e2635`.

## Layout

- Máx. 1100px centralizado; grid auto-fill de cards; espaçamento maior acima de títulos de seção.
- Seções: painel → carteira → mercado (index); toolbar → lista → diálogos (carteira).

## Motion

Transições sutis de 0.12–0.15s em botões e hover de cards. Sem animações de entrada espalhadas.

## Accessibility

Contraste ≥4.5:1 no tema escuro (texto `#e6edf3` sobre `#0a0e14` ≈ 15:1; muted `#8b98a9` ≈ 6:1). Foco visível em `--accent`. Seleção e scrollbar herdam o tema via `:root`. Layout responsivo com breakpoint em 480px.
