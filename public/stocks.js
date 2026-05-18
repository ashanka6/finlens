const tickerInput = document.getElementById('tickerInput');
const loadButton = document.getElementById('loadButton');
const saveWatchlistButton = document.getElementById('saveWatchlistButton');
const watchlistUserInput = document.getElementById('watchlistUserInput');
const feedbackArea = document.getElementById('feedbackArea');
const summaryContent = document.getElementById('summaryContent');
const metricsContent = document.getElementById('metricsContent');
const incomeContent = document.getElementById('incomeContent');
const balanceContent = document.getElementById('balanceContent');
const watchlistArea = document.getElementById('watchlistArea');
const watchlistSlides = document.getElementById('watchlistSlides');
const watchlistGlideContainer = document.getElementById('watchlistGlide');
const chartCanvas = document.getElementById('metricsChart');
let metricsChart = null;
let watchlistGlide = null;

function showMessage(message, type = 'error') {
  feedbackArea.textContent = message;
  feedbackArea.className = `feedback-area ${type}`;
}

function clearMessage() {
  feedbackArea.textContent = '';
  feedbackArea.className = 'feedback-area hidden';
}

function formatValue(value, isCurrency = false) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  if (isCurrency) {
    return number.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function renderTable(container, headers, rows) {
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'data-table';

  const headerRow = document.createElement('tr');
  headers.forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

function renderSummary(data) {
  const income = data.incomeStatement?.[0] || {};
  const balance = data.balanceSheet?.[0] || {};
  const ratio = data.financialRatios?.[0] || {};

  summaryContent.innerHTML = `
    <p><strong>Ticker:</strong> ${data.ticker || 'N/A'}</p>
    <p><strong>Date:</strong> ${income.date || balance.date || 'N/A'}</p>
    <p><strong>Revenue:</strong> ${formatValue(income.revenue, true)}</p>
    <p><strong>Net Income:</strong> ${formatValue(income.netIncome, true)}</p>
    <p><strong>Total Assets:</strong> ${formatValue(balance.totalAssets, true)}</p>
    <p><strong>Total Liabilities:</strong> ${formatValue(balance.totalLiabilities, true)}</p>
    <p><strong>Current Ratio:</strong> ${formatValue(ratio.currentRatio)}</p>
  `;
}

function renderMetrics(data) {
  const ratio = data.financialRatios?.[0] || {};
  const rows = [
    ['Market cap', formatValue(ratio.marketCap, true)],
    ['EPS', formatValue(ratio.eps)],
    ['P/E ratio', formatValue(ratio.peRatio)],
    ['Current ratio', formatValue(ratio.currentRatio)],
  ];
  renderTable(metricsContent, ['Metric', 'Value'], rows);
}

function createMetricsChart(data) {
  const incomes = data.incomeStatement || [];
  const labels = incomes.slice(0, 5).map((item) => item.date || 'N/A').reverse();
  const revenueValues = incomes.slice(0, 5).map((item) => Number(item.revenue) || 0).reverse();
  const netIncomeValues = incomes.slice(0, 5).map((item) => Number(item.netIncome) || 0).reverse();

  if (!chartCanvas) return;

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenueValues,
        borderColor: '#151db1',
        backgroundColor: 'rgba(21,29,177,0.18)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Net Income',
        data: netIncomeValues,
        borderColor: '#3c5cdf',
        backgroundColor: 'rgba(60,92,223,0.16)',
        fill: true,
        tension: 0.3,
      }
    ]
  };

  const config = {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: $${Number(context.parsed.y).toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `$${Number(value).toLocaleString()}`
          }
        }
      }
    }
  };

  if (metricsChart) {
    metricsChart.destroy();
  }
  metricsChart = new Chart(chartCanvas, config);
}

function renderIncome(data) {
  const rows = (data.incomeStatement || []).slice(0, 5).map((item) => [
    item.date || 'N/A',
    formatValue(item.revenue, true),
    formatValue(item.grossProfit, true),
    formatValue(item.netIncome, true),
  ]);

  if (!rows.length) {
    incomeContent.innerHTML = '<p class="muted">No income statement data.</p>';
    return;
  }

  renderTable(incomeContent, ['Date', 'Revenue', 'Gross Profit', 'Net Income'], rows);
}

function renderBalance(data) {
  const rows = (data.balanceSheet || []).slice(0, 5).map((item) => [
    item.date || 'N/A',
    formatValue(item.totalAssets, true),
    formatValue(item.totalLiabilities, true),
    formatValue(item.totalStockholdersEquity, true),
  ]);

  if (!rows.length) {
    balanceContent.innerHTML = '<p class="muted">No balance sheet data.</p>';
    return;
  }

  renderTable(balanceContent, ['Date', 'Total Assets', 'Total Liabilities', 'Equity'], rows);
}

async function loadFinancials(ticker) {
  clearMessage();
  summaryContent.innerHTML = '<p class="muted">Loading data...</p>';
  metricsContent.innerHTML = '';
  incomeContent.innerHTML = '';
  balanceContent.innerHTML = '';

  try {
    const response = await fetch(`/api/financials/${encodeURIComponent(ticker)}`, {
      mode: 'cors',
      headers: { Accept: 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error || data?.details || data?.message || `Failed to load ${ticker}`;
      throw new Error(message);
    }

    renderSummary(data);
    renderMetrics(data);
    createMetricsChart(data);
    renderIncome(data);
    renderBalance(data);
  } catch (error) {
    showMessage(error.message || 'Unable to load stock data.');
    summaryContent.innerHTML = '<p class="muted">Unable to load company data. Try again.</p>';
  }
}

function getQueryTicker() {
  return new URLSearchParams(window.location.search).get('ticker')?.trim().toUpperCase() || '';
}

async function loadWatchlist(userId) {
  if (!userId) return;

  try {
    const response = await fetch(`/api/watchlist/${encodeURIComponent(userId)}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to load watchlist');
    }
    renderWatchlist(data);
  } catch (error) {
    watchlistArea.innerHTML = `<p class="muted">${error.message || 'Unable to load saved watchlist.'}</p>`;
  }
}

function renderWatchlist(items) {
  const watchlistMessage = document.getElementById('watchlistMessage');
  if (!items || !items.length) {
    if (watchlistMessage) {
      watchlistMessage.textContent = 'No watchlist items saved yet.';
    }
    watchlistSlides.innerHTML = '';
    watchlistGlideContainer.classList.add('hidden');
    return;
  }

  if (watchlistMessage) {
    watchlistMessage.textContent = `Showing ${items.length} saved ticker${items.length === 1 ? '' : 's'}.`;
  }

  watchlistSlides.innerHTML = items
    .map((item) => `
      <li class="glide__slide">
        <div class="watchlist-item-card">
          <strong>${item.ticker}</strong>
          <p>ID: ${item.id}</p>
        </div>
      </li>
    `)
    .join('');

  watchlistGlideContainer.classList.remove('hidden');
  if (watchlistGlide) {
    watchlistGlide.destroy();
  }
  watchlistGlide = new Glide('#watchlistGlide', {
    type: 'carousel',
    startAt: 0,
    perView: 3,
    gap: 24,
    breakpoints: {
      920: { perView: 2 },
      620: { perView: 1 }
    }
  });
  watchlistGlide.mount();
}

function init() {
  const queryTicker = getQueryTicker();
  const userId = watchlistUserInput.value.trim() || 'demo-user';
  if (queryTicker) {
    tickerInput.value = queryTicker;
    loadFinancials(queryTicker);
  }

  loadButton.addEventListener('click', () => {
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
      showMessage('Enter a ticker symbol first.');
      return;
    }
    history.replaceState(null, '', `stocks.html?ticker=${encodeURIComponent(ticker)}`);
    loadFinancials(ticker);
  });

  saveWatchlistButton.addEventListener('click', async () => {
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
      showMessage('Enter a ticker symbol before saving.');
      return;
    }
    const currentUserId = watchlistUserInput.value.trim() || 'demo-user';

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, ticker }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save watchlist item.');
      }

      showMessage(`Saved ${ticker} to ${currentUserId}'s watchlist.`, 'success');
      loadWatchlist(currentUserId);
    } catch (error) {
      showMessage(error.message || 'Unable to save watchlist item.');
    }
  });

  loadWatchlist(userId);
}

window.addEventListener('DOMContentLoaded', init); 
