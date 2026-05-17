// index.js - FinLens Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;
const dotenv = require('dotenv'); 
dotenv.config();
// ==================== Middleware ====================
app.use(cors());
app.use(express.json());

// ==================== Supabase Client ====================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ==================== Helper: Call FMP API ====================
const fetchFMP = async (endpoint) => {
    const baseURL = 'https://financialmodelingprep.com/api/v3';
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseURL}${endpoint}${separator}apikey=${process.env.FMP_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`);
    }
    return response.json();
};

// ==================== Routes ====================

// 1. Get financial data for a ticker (income statement, balance sheet, ratios)
app.get('/api/financials/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();

    try {
        // Fetch all three data sets in parallel
        const [income, balance, ratios] = await Promise.all([
            fetchFMP(`/income-statement/${upperTicker}?limit=5`),
            fetchFMP(`/balance-sheet-statement/${upperTicker}?limit=5`),
            fetchFMP(`/financial-ratios/${upperTicker}`)
        ]);

        res.json({
            ticker: upperTicker,
            incomeStatement: income,
            balanceSheet: balance,
            financialRatios: ratios
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch financial data' });
    }
});

// 2. Get a user's portfolio (watchlist) from Supabase
app.get('/api/portfolio/:userId', async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// 3. Add a ticker to user's portfolio
app.post('/api/portfolio', async (req, res) => {
    const { user_id, ticker, notes } = req.body;

    if (!user_id || !ticker) {
        return res.status(400).json({ error: 'user_id and ticker are required' });
    }

    const { data, error } = await supabase
        .from('portfolios')
        .insert([{ user_id, ticker: ticker.toUpperCase(), notes: notes || '' }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
});

// 4. Delete a ticker from portfolio
app.delete('/api/portfolio/:entryId', async (req, res) => {
    const { entryId } = req.params;

    const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', entryId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(204).send();
});

// 5. Update notes for a portfolio entry
app.patch('/api/portfolio/:entryId', async (req, res) => {
    const { entryId } = req.params;
    const { notes } = req.body;

    const { data, error } = await supabase
        .from('portfolios')
        .update({ notes, updated_at: new Date() })
        .eq('id', entryId)
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
});

// 6. Simple health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'FinLens backend is running' });
});

// ==================== Start Server ====================
app.listen(PORT, () => {
    console.log(`✅ FinLens server running on http://localhost:${PORT}`);
});