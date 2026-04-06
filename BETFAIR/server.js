const express = require('express');
const axios = require('axios');
const cors = require('cors');
// const oddsService = require('./services/oddsService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Betfair API endpoint
app.get('/api/betfair/markets', async (req, res) => {
  try {
    const marketIds = req.query.marketIds || '1.246992876,1.246992318,1.246992408,1.246992498,1.246992696,1.247011641,1.246992228,1.246992095,1.246992786,1.246992966,1.247277022,1.247277164,1.247277284,1.247277404,1.247276176,1.247276299,1.247276420,1.247276540,1.247276660,1.247276780,1.247333172,1.247333262,1.247333352,1.247333491,1.247333581,1.247524498,1.247606209,1.247036327,1.247036087,1.247035127,1.247034887,1.247034647,1.247036207,1.247035727,1.247034527,1.247035967,1.247035401';
    
    const config = {
      method: 'GET',
      url: 'https://ero.betfair.ro/www/sports/exchange/readonly/v1/bymarket',
      params: {
        _ak: 'nzIFcwyWhrlwYMrh',
        alt: 'json',
        currencyCode: 'RON',
        locale: 'en_GB',
        marketIds: marketIds,
        rollupLimit: 10,
        rollupModel: 'STAKE',
        types: 'MARKET_STATE,RUNNER_STATE,RUNNER_EXCHANGE_PRICES_BEST'
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      proxy: {
        protocol: 'http',
        host: process.env.PROXY_HOST,
        port: parseInt(process.env.PROXY_PORT),
        auth: {
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD
        }
      },
      timeout: 30000
    };

    const response = await axios(config);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching Betfair data:', error.message);
    
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      },
      timestamp: new Date().toISOString()
    });
  }
});


// Endpoint to update cookies
app.post('/api/oddspedia/update-cookies', (req, res) => {
  try {
    const { cookies } = req.body;
    
    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Cookies parameter is required'
      });
    }

    oddsService.updateCookies(cookies);
    
    res.json({
      success: true,
      message: 'Cookies updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get current cookies
app.get('/api/oddspedia/cookies', (req, res) => {
  try {
    const cookies = oddsService.getCookies();
    
    res.json({
      success: true,
      cookies: cookies,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Betfair API endpoint: http://localhost:${PORT}/api/betfair/markets`);
  console.log(`Oddspedia API v2 endpoint: http://localhost:${PORT}/api/oddspedia/bookmakers-v2`);
});
