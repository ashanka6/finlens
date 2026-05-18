const dotenv = require('dotenv');
dotenv.config();
const express = require('express'); 
const bodyParser = require('body-parser'); 
const supabaseClient = require('@supabase/supabase-js'); 


const app = express();
const PORT = 5000; 

const cors = require('cors'); 

const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey);




app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile('public/home.html', { root: __dirname });
});



const fetchFMP = async (endpoint) => {
    const baseURL = 'https://financialmodelingprep.com/api/v3/';
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseURL}${endpoint}${separator}apikey=${process.env.FMP_API_KEY}`;

    const response = await fetch(url);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error || payload?.message || response.statusText;
        throw new Error(`FMP API error: ${response.status} ${message || 'Unknown error'}`);
    }
    return payload;
};


app.get('/api/v3/financials/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();

    try {
        const [income, balance, ratios] = await Promise.all([
            fetchFMP(`income-statement?symbol=${upperTicker}&limit=5`),
            fetchFMP(`balance-sheet-statement?symbol=${upperTicker}&limit=5`),
            fetchFMP(`ratios?symbol=${upperTicker}`)
        ]);

        res.json({
            ticker: upperTicker,
            incomeStatement: income,
            balanceSheet: balance,
            financialRatios: ratios
        });
    } catch (error) {
        console.error('Financials fetch failed:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch financial data', details: error.message });
    }
});


app.get('/api/v3/quote/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();

    try {
        const quotePayload = await fetchFMP(`/quote?symbol=${upperTicker}`);
        res.json({ ticker: upperTicker, quote: quotePayload?.[0] || null });
    } catch (error) {
        console.error('Quote fetch failed:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch quote data', details: error.message });
    }
});


app.get('/api/v3/watchlist/:userId', async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('watchlists')     
        .select('id, ticker')   
        .eq('user_id', userId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data); 
});


app.post('/api/v3/watchlist', async (req, res) => {
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


app.delete('/api/v3/watchlist/:entryId', async (req, res) => {
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


app.get('/api/v3/notes/:userId/:ticker', async (req, res) => {
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



