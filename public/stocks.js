const tickerInput = document.getElementById('tickerInput');
const loadButton = document.getElementById('loadButton');
const feedbackArea = document.getElementById('feedbackArea');
const summaryContent = document.getElementById('summaryContent');
const metricsContent = document.getElementById('metricsContent');
const incomeContent = document.getElementById('incomeContent');
const balanceContent = document.getElementById('balanceContent');

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

    if (!response.ok) {
      throw new Error(`Failed to load ${ticker}`);
    }

    const data = await response.json();
    renderSummary(data);
    renderMetrics(data);
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

function init() {
  const queryTicker = getQueryTicker();
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
}

window.addEventListener('DOMContentLoaded', init);