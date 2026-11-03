const API_BASE = 'http://localhost:8080';

// Estado
let cryptoData = [];
let isLoading = false;

// Elementos da UI
const listEl = document.getElementById('crypto-list');
const searchInput = document.getElementById('search');
const filterMarketCap = document.getElementById('filter-marketcap');
const filterChange = document.getElementById('filter-change');

// Carrega dados iniciais
async function loadCrypto() {
  if (isLoading) return;
  isLoading = true;

  // Limpa lista de forma segura
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  const loadingLi = document.createElement('li');
  loadingLi.className = 'loading';
  loadingLi.textContent = 'Carregando...';
  listEl.appendChild(loadingLi);

  try {
    const response = await fetch(`${API_BASE}/crypto?pagesize=100`);
    if (!response.ok) throw new Error('Falha ao carregar');
    cryptoData = await response.json();
    renderList();
  } catch (e) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    const errorLi = document.createElement('li');
    errorLi.className = 'error';
    errorLi.textContent = `Erro: ${e.message}`;
    listEl.appendChild(errorLi);
  } finally {
    isLoading = false;
  }
}

// Renderiza lista filtrada
function renderList() {
  const search = searchInput.value.toLowerCase();
  const marketCapFilter = filterMarketCap.value;
  const changeFilter = filterChange.value;

  const filtered = cryptoData.filter(item => {
    // Busca por nome ou símbolo (converte campos para string para evitar erros se undefined)
    const name = (item.name || '').toLowerCase();
    const symbol = (item.symbol || '').toLowerCase();

    const matchesSearch = name.includes(search) || symbol.includes(search);
    if (!matchesSearch) return false;

    // Filtro market cap
    if (marketCapFilter === 'gt-1b' && item.marketCap <= 1000000000) return false;
    if (marketCapFilter === 'lt-1b' && item.marketCap >= 1000000000) return false;

    // Filtro variação 24h
    if (changeFilter === 'gt-0' && item.change24h <= 0) return false;
    if (changeFilter === 'lt-0' && item.change24h >= 0) return false;

    return true;
  });

  // Limpa lista atual
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  if (filtered.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'loading';
    emptyLi.textContent = 'Nenhum resultado encontrado';
    listEl.appendChild(emptyLi);
    return;
  }

  filtered.forEach(item => {
    const li = document.createElement('li');
    li.className = 'item';

    const container = document.createElement('div');

    // Título (Símbolo – Nome)
    const h2 = document.createElement('h2');
    const spanSymbol = document.createElement('span');
    spanSymbol.className = 'symbol';
    spanSymbol.textContent = item.symbol;
    h2.appendChild(spanSymbol);
    h2.appendChild(document.createTextNode(` – ${item.name}`));

    // Preço
    const priceDiv = document.createElement('div');
    priceDiv.className = 'price';
    priceDiv.textContent = `$${(item.price || 0).toLocaleString()}`;

    // Variação 24h
    const changeDiv = document.createElement('div');
    const changeValue = item.change24h || 0;
    const changeClass = changeValue >= 0 ? 'positive' : 'negative';
    const changeSign = changeValue >= 0 ? '+' : '';
    changeDiv.className = `change ${changeClass}`;
    changeDiv.textContent = `${changeSign}${changeValue.toFixed(2)}%`;

    // Market Cap
    const mcapDiv = document.createElement('div');
    mcapDiv.className = 'marketcap';
    const mcapFormatted = (item.marketCap || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    mcapDiv.textContent = `Cap. de mercado: $${mcapFormatted}`;

    container.appendChild(h2);
    container.appendChild(priceDiv);
    container.appendChild(changeDiv);
    container.appendChild(mcapDiv);
    li.appendChild(container);
    listEl.appendChild(li);
  });
}

// Eventos
searchInput.addEventListener('input', renderList);
filterMarketCap.addEventListener('change', renderList);
filterChange.addEventListener('change', renderList);

// Inicialização
loadCrypto();