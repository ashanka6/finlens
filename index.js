// index.js - FinLens Backend Server

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // For server-side API calls
const app = express();
const PORT = process.env.PORT || 5000;
const dotenv = require('dotenv'); 
dotenv.config();
// ==================== Middleware ====================
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true })); 
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(__dirname + '/public')); 

app.get('/', (req, res) => {
  res.sendFile('public/home.html', { root: __dirname });
});


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

// 1. Get financial data for a ticker (external API) – unchanged
app.get('/api/financials/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();

    try {
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

// 2. READ from Supabase: get a user's watchlist (tickers only)
app.get('/api/watchlist/:userId', async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('watchlists')     // your actual table name
        .select('id, ticker')   // only select what you need
        .eq('user_id', userId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data); // returns [{ id, ticker }, ...]
});

// 3. WRITE to Supabase: add a ticker to user's watchlist
app.post('/api/watchlist', async (req, res) => {
    const { user_id, ticker } = req.body;
    const userId = user_id || process.env.DEFAULT_USER_ID || 'demo-user';

    if (!userId || !ticker) {
        return res.status(400).json({ error: 'user_id and ticker are required' });
    }

    const { data, error } = await supabase
        .from('watchlists')
        .insert([{ user_id: userId, ticker: ticker.toUpperCase() }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
});

// 4. (Optional) Delete a ticker from watchlist
app.delete('/api/watchlist/:entryId', async (req, res) => {
    const { entryId } = req.params;

    const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', entryId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(204).send();
});

// 5. (Optional) Get user notes for a ticker (from user_notes table)
app.get('/api/notes/:userId/:ticker', async (req, res) => {
    const { userId, ticker } = req.params;

    const { data, error } = await supabase
        .from('user_notes')
        .select('notes, created_at')
        .eq('user_id', userId)
        .eq('ticker', ticker.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data?.[0] || { notes: '' });
});

// 6. (Optional) Save/update user note
app.post('/api/notes', async (req, res) => {
    const { user_id, ticker, notes } = req.body;

    if (!user_id || !ticker) {
        return res.status(400).json({ error: 'user_id and ticker required' });
    }

    const { data, error } = await supabase
        .from('user_notes')
        .insert([{ user_id, ticker: ticker.toUpperCase(), notes: notes || '' }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
});

// 7. Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'FinLens backend running with watchlists & user_notes' });
});

// ==================== Start Server ====================
app.listen(PORT, () => {
    console.log(`FinLens server running on http://localhost:${PORT}`);
});