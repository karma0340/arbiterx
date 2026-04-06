const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const { engine: matchingEngine } = require('./matching-engine');
const { saveOpportunity, getOpportunities, getStats } = require('./db');
const { notifyArb, isConfigured: telegramConfigured } = require('./telegram');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());

// ─── In-memory store ─────────────────────────────────────────────────────────
const opportunityStore = [];
const MAX_STORE = 500;

function addToStore(opp) {
  // Deduplicate by id
  const idx = opportunityStore.findIndex(o => o.id === opp.id);
  if (idx !== -1) opportunityStore.splice(idx, 1);
  opportunityStore.unshift(opp);
  if (opportunityStore.length > MAX_STORE) opportunityStore.pop();
  if (opp.isReal) saveOpportunity(opp);
}

function clearRealStore() {
  // Remove all non-mock entries so fresh reload doesn't get buried by stale data
  const toRemove = opportunityStore.filter(o => o.isReal);
  toRemove.forEach(o => {
    const i = opportunityStore.indexOf(o);
    if (i !== -1) opportunityStore.splice(i, 1);
  });
}

// ─── Scraper state tracker ────────────────────────────────────────────────────
const scraperState = {
  baywin:  { lastRun: null, lastCount: 0, status: 'idle' },
  golbet:  { lastRun: null, lastCount: 0, status: 'idle' },
  papa:    { lastRun: null, lastCount: 0, status: 'idle' },
  kolay40: { lastRun: null, lastCount: 0, status: 'idle' },
  oddspedia: { lastRun: null, lastCount: 0, status: 'idle' },
  orbit:   { lastRun: null, lastCount: 0, status: 'idle' },
  exchange:{ lastRun: null, lastCount: 0, status: 'idle' },
};

// ─── Matching engine → real arb events ────────────────────────────────────────
matchingEngine.on('arbFound', (opp) => {
  addToStore(opp);
  io.emit('newOpportunity', opp);
  console.log(`[Engine] 🎯 REAL ARB: ${opp.event} +${opp.arbPercentage.toFixed(2)}%`);
});

// ─── Bookmaker + Exchange config ──────────────────────────────────────────────
const BOOKMAKERS = [
  { key: 'baywin',  name: 'Baywin',  file: 'baywin_odds.json',  link: 'https://355baywin.com/tr-tr/live' },
  { key: 'golbet',  name: 'Golbet',  file: 'golbet_odds.json',  link: 'https://golbet724.com/tr/live' },
  { key: 'papa',    name: 'Papa',    file: 'papa_odds.json',    link: 'https://papa.live/live' },
  { key: 'kolay40', name: 'Kolay40', file: 'kolay40_odds.json', link: 'https://kolay40.com/canli-bahis' },
  { key: 'oddspedia', name: 'Oddspedia', file: 'oddspedia_odds.json', link: 'https://oddspedia.com' },
];

const EXCHANGES = [
  { name: 'Betfair',  link: 'https://www.betfair.com/exchange/plus/football', spread: 0.95 },
  { name: 'Orbit',    link: 'https://orbitxch.com/en-gb/sports',              spread: 0.94 },
  { name: 'SharpX',   link: 'https://sharpx.com',                             spread: 0.93 },
  { name: 'B33M',     link: 'https://b33m.com',                               spread: 0.92 },
  { name: 'Laystars', link: 'https://laystars.com',                           spread: 0.91 },
];

const SPORT_EMOJIS = {
  Soccer: '⚽', Basketball: '🏀', Tennis: '🎾',
  'Ice Hockey': '🏒', 'American Football': '🏈', Boxing: '🥊',
};

// ─── Load odds from any *_odds.json file ──────────────────────────────────────
function loadOddsFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) return [];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data) || data.length === 0) return [];
    // Only use data fresh within last 30 minutes
    return data.filter(e => {
      if (!e.scrapedAt) return true;
      return Date.now() - new Date(e.scrapedAt).getTime() < 30 * 60 * 1000;
    });
  } catch (_) { return []; }
}

// ─── Publish scraped odds as opportunities ────────────────────────────────────
function publishOdds(events, bookmakerConfig) {
  if (!events || events.length === 0) return 0;
  let published = 0;

  for (const ev of events) {
    if (!ev.event || !ev.odds || ev.odds.length === 0) continue;
    const odds = ev.odds.filter(o => o && o > 1.01);
    if (odds.length === 0) continue;

    const selLabels = odds.length >= 3 ? ['Home', 'Draw', 'Away'] : ['Home', 'Away'];

    // Feed ALL selections into matching engine for 3-way arb detection
    odds.slice(0, 3).forEach((backOdds, i) => {
      matchingEngine.addBookmakerData({
        event:       ev.event,
        market:      'Match Winner',
        selection:   selLabels[i] || 'Home',
        odds:        backOdds,
        bookmaker:   bookmakerConfig.name,
        link:        ev.link || bookmakerConfig.link,
        sport:       ev.sport || 'Soccer',
        competition: ev.competition || 'Live',
        isLive:      ev.isLive !== false,
      });
    });

    // Also stream individual bookmaker rows to the store for display
    // (real arb cards are emitted by matchingEngine 'arbFound' event)
    odds.slice(0, 3).forEach((backOdds, i) => {
      const sel = selLabels[i] || 'Home';
      // Show best counteroffer as "exchange" equivalent for the display card
      const oppositeIdx = i === 0 ? (odds.length - 1) : 0;
      const oppositeOdds = odds[oppositeIdx];
      const oppBm = bookmakerConfig.name;

      const arbPct = parseFloat(((1 - (1 / backOdds) - (1 / oppositeOdds)) * 100).toFixed(2));

      const opp = {
        id: `${bookmakerConfig.key}-${ev.id || Date.now()}-${i}`,
        sport:               ev.sport || 'Soccer',
        sportEmoji:          SPORT_EMOJIS[ev.sport] || '⚽',
        competition:         ev.competition || 'Live',
        event:               ev.event,
        eventDate:           new Date().toISOString(),
        isLive:              ev.isLive !== false,
        market:              'Match Winner',
        selection:           sel,
        arbPercentage:       arbPct,
        bookmaker:           bookmakerConfig.name,
        bookmakerOdds:       backOdds,
        bookmakerLink:       ev.link || bookmakerConfig.link,
        exchanger:           oppBm,
        exchangerOdds:       oppositeOdds,
        exchangerLiquidity:  0,
        exchangerLink:       ev.link || bookmakerConfig.link,
        createdAt:           new Date().toISOString(),
        isReal:              true,
        source:              bookmakerConfig.key,
        legs:                odds.slice(0, 3).map((o, j) => ({
          selection: selLabels[j] || 'Home',
          bookmaker: bookmakerConfig.name,
          odds: o,
          link: ev.link || bookmakerConfig.link,
        })),
      };

      addToStore(opp);
      io.emit('newOpportunity', opp);
      published++;
    });
  }

  return published;
}

// ─── Load all bookmaker sources ───────────────────────────────────────────────
function loadAllBookmakers() {
  // Clear stale real data so bookmakers don't get buried by load order
  clearRealStore();

  let totalEvents = 0;
  let totalPublished = 0;

  for (const bm of BOOKMAKERS) {
    const events = loadOddsFile(bm.file);
    scraperState[bm.key] = {
      lastRun: new Date().toISOString(),
      lastCount: events.length,
      status: events.length > 0 ? 'ok' : 'no_data',
    };

    if (events.length > 0) {
      // Cache for 300ms continuous scan loop
      loadedBookmakerData.set(bm.key, events);
      const n = publishOdds(events, bm);
      totalEvents += events.length;
      totalPublished += n;
      console.log(`[Feed] ✅ ${bm.name}: ${events.length} events → ${n} opportunities`);
    } else {
      loadedBookmakerData.delete(bm.key);
    }
  }

  if (totalEvents > 0) {
    console.log(`[Feed] 🔴 Total real data: ${totalEvents} events, ${totalPublished} opportunities`);
    return true;
  }
  return false;
}

// ─── Load Orbit exchange data ─────────────────────────────────────────────────
function loadOrbitExchange() {
  const events = loadOddsFile('orbit_odds.json');
  if (events.length === 0) return;

  scraperState.orbit = {
    lastRun: new Date().toISOString(),
    lastCount: events.length,
    status: 'ok',
  };

  for (const ev of events) {
    if (!ev.event || !ev.layOdds) continue;
    matchingEngine.addExchangeData({
      event: ev.event,
      market: ev.market || 'Match Winner',
      selection: ev.selection || 'Home',
      layOdds: ev.layOdds,
      exchanger: 'Orbit',
      link: ev.link || 'https://orbitxch.com',
      liquidity: ev.liquidity || 0,
    });
  }
  console.log(`[Feed] ♻️  Orbit Exchange: ${events.length} lay prices → matching engine`);
}

// ─── Auto-spawn scrapers as child processes ───────────────────────────────────
function spawnScraper(scraperFile, label) {
  const scriptPath = path.join(__dirname, 'scrapers', scraperFile);
  if (!fs.existsSync(scriptPath)) return;

  console.log(`[Spawn] 🚀 Launching ${label} scraper...`);
  const child = spawn('node', [scriptPath], {
    cwd: __dirname,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[${label} ERR] ${d}`));
  child.on('close', (code) => {
    console.log(`[Spawn] ${label} exited (${code})`);
    // Reload data after scraper finishes
    setTimeout(() => loadAllBookmakers(), 2000);
  });
  child.on('error', e => console.error(`[Spawn] ${label} error:`, e.message));
}

// Run scrapers on a staggered schedule (faster intervals for live arb)
function startScraperSchedule() {
  const MIN = 60 * 1000;

  // Run each scraper immediately on startup, staggered by 30s each
  setTimeout(() => spawnScraper('baywin.js',  'Baywin'),  0 * 1000);
  setTimeout(() => spawnScraper('golbet.js',  'Golbet'),  30 * 1000);
  setTimeout(() => spawnScraper('papa.js',    'Papa'),    60 * 1000);
  setTimeout(() => spawnScraper('kolay40.js', 'Kolay40'), 90 * 1000);
  setTimeout(() => spawnScraper('oddspedia.js', 'Oddspedia'), 120 * 1000);

  // Then repeat every 3 minutes (staggered so only 1 browser at a time)
  setInterval(() => spawnScraper('baywin.js',  'Baywin'),  3 * MIN);
  setTimeout(() => setInterval(() => spawnScraper('golbet.js',  'Golbet'),  3 * MIN), 30 * 1000);
  setTimeout(() => setInterval(() => spawnScraper('papa.js',    'Papa'),    4 * MIN), 60 * 1000);
  setTimeout(() => setInterval(() => spawnScraper('kolay40.js', 'Kolay40'), 5 * MIN), 90 * 1000);
  setTimeout(() => setInterval(() => spawnScraper('oddspedia.js', 'Oddspedia'), 5 * MIN), 120 * 1000);

  console.log('[Schedule] ✅ All scrapers scheduled (3-5 min intervals, starting immediately)');
}

// ─── 300ms Continuous Re-Scan Loop ───────────────────────────────────────────
// Re-feeds all loaded bookmaker data into the matching engine every 300ms.
// This means any previously-stored arb that just opened up due to a minor
// price shift is caught in near-real-time without waiting for a full scrape.
const loadedBookmakerData = new Map(); // source -> events array

function startContinuousScan() {
  setInterval(() => {
    // Re-check all events stored in the matching engine for updated arb
    // The engine deduplicates via recentlyEmitted (30s window)
    for (const [source, events] of loadedBookmakerData.entries()) {
      const bm = BOOKMAKERS.find(b => b.key === source);
      if (!bm) continue;
      for (const ev of events) {
        if (!ev.odds) continue;
        const selLabels = ev.odds.length >= 3 ? ['Home', 'Draw', 'Away'] : ['Home', 'Away'];
        ev.odds.slice(0, 3).forEach((odds, i) => {
          matchingEngine.addBookmakerData({
            event: ev.event, market: 'Match Winner',
            selection: selLabels[i] || 'Home',
            odds, bookmaker: bm.name,
            link: ev.link || bm.link,
            sport: ev.sport || 'Soccer',
            competition: ev.competition || 'Live',
            isLive: ev.isLive !== false,
          });
        });
      }
    }
  }, 300); // Every 300ms
  console.log('[RealTime] ✅ 300ms continuous arb scan loop started');
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/opportunities', (_req, res) => {
  // Sort by arbPercentage descending so best opportunities always come first
  const sorted = [...opportunityStore].sort((a, b) => (b.arbPercentage || 0) - (a.arbPercentage || 0));
  res.json(sorted.slice(0, 100));
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storeSize: opportunityStore.length,
    bookmakerOddsInEngine: matchingEngine.bookmakerOdds.size,
    exchangeOddsInEngine: matchingEngine.exchangeOdds.size,
    uptime: Math.round(process.uptime()),
    scrapers: scraperState,
    db: getStats(),
  });
});

app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const history = getOpportunities(limit);
  res.json(history);
});

app.get('/api/stats', (_req, res) => {
  const dbStats = getStats();
  const realCount = opportunityStore.filter(o => o.isReal).length;
  const sources = {};
  for (const bm of ['baywin', 'golbet', 'papa', 'kolay40', 'mock']) {
    sources[bm] = opportunityStore.filter(o => o.source === bm).length;
  }
  res.json({ ...dbStats, liveStore: opportunityStore.length, realInStore: realCount, sourceBreakdown: sources });
});

app.get('/api/scraper/status', (_req, res) => {
  const sources = BOOKMAKERS.map(bm => ({
    name: bm.name, key: bm.key,
    ...scraperState[bm.key],
    fileExists: fs.existsSync(path.join(__dirname, bm.file)),
  }));
  res.json({ sources, exchange: scraperState.orbit });
});

app.post('/api/scraper/reload', async (_req, res) => {
  const hasData = loadAllBookmakers();
  loadOrbitExchange();
  res.json({ ok: true, hasRealData: hasData, scrapers: scraperState });
});

app.post('/api/scraper/run/:name', (req, res) => {
  const { name } = req.params;
  const scraperMap = { baywin: 'baywin.js', golbet: 'golbet.js', papa: 'papa.js', kolay40: 'kolay40.js', orbit: 'orbit.js', oddspedia: 'oddspedia.js' };
  const file = scraperMap[name];
  if (!file) return res.status(400).json({ error: 'Unknown scraper' });
  spawnScraper(file, name);
  res.json({ ok: true, message: `${name} scraper launched` });
});

app.post('/api/feed/bookmaker', (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'data must be array' });
  data.forEach(item => matchingEngine.addBookmakerData(item));
  res.json({ received: data.length });
});

app.post('/api/feed/exchange', (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'data must be array' });
  data.forEach(item => matchingEngine.addExchangeData(item));
  res.json({ received: data.length });
});

// ─── Mock engine (only when NO real data) ────────────────────────────────────
const MOCK_EVENTS = [
  { event: 'Fenerbahçe vs Gaziantep FK', competition: 'Türkiye Süper Lig', sport: 'Soccer', isLive: true },
  { event: 'Sporting CP vs Bodo Glimt', competition: 'UEFA Champions League', sport: 'Soccer', isLive: true },
  { event: 'Al Wahda FC vs Al Ain FC', competition: 'UAE Arabian Gulf League', sport: 'Soccer', isLive: true },
  { event: 'Mamelodi Sundowns vs Tshakhuma FC', competition: 'SA Premier Soccer League', sport: 'Soccer', isLive: true },
  { event: 'Philadelphia Union vs CF America', competition: 'CONCACAF Champions Cup', sport: 'Soccer', isLive: true },
  { event: 'Lakers vs Celtics', competition: 'NBA', sport: 'Basketball', isLive: true },
  { event: 'Alcaraz vs Sinner', competition: 'ATP Masters', sport: 'Tennis', isLive: false },
  { event: 'Suzhou Cats vs Shanghai Fives', competition: 'China CBA', sport: 'Basketball', isLive: true },
];

function startMockEngine() {
  const mockExchanges = ['Betfair', 'Orbit', 'SharpX', 'B33M', 'Laystars'];
  const mockBooks = ['Baywin', 'Golbet', 'Papa', 'Kolay40'];

  const pushNext = () => {
    // Only push mock if ALL bookmaker files are empty or stale
    const hasAnyRealData = BOOKMAKERS.some(bm => loadOddsFile(bm.file).length > 0);
    if (!hasAnyRealData) {
      const evt = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
      const back = parseFloat((1.8 + Math.random() * 5).toFixed(2));
      const lay = parseFloat((back * (0.89 + Math.random() * 0.06)).toFixed(2));
      const exch = mockExchanges[Math.floor(Math.random() * mockExchanges.length)];
      const bm = mockBooks[Math.floor(Math.random() * mockBooks.length)];

      const opp = {
        id: Math.random().toString(36).substr(2, 9),
        sport: evt.sport, sportEmoji: SPORT_EMOJIS[evt.sport] || '⚽',
        competition: evt.competition, event: evt.event,
        eventDate: new Date().toISOString(), isLive: evt.isLive,
        market: 'Match Winner', selection: 'Home',
        arbPercentage: Math.abs((1 - 1/back - 1/lay) * 100),
        bookmaker: bm, bookmakerOdds: back,
        bookmakerLink: `https://355baywin.com/tr-tr/live`,
        exchanger: exch, exchangerOdds: lay,
        exchangerLiquidity: Math.floor(Math.random() * 600 + 100),
        exchangerLink: `https://orbitxch.com`,
        createdAt: new Date().toISOString(),
        isReal: false, source: 'mock',
      };
      addToStore(opp);
      io.emit('newOpportunity', opp);
    }
    setTimeout(pushNext, 2500 + Math.random() * 2000);
  };
  setTimeout(pushNext, 1500);
  console.log('[Mock] Standby — pauses automatically when real data loads');
}

// ─── Wire matching engine arbFound → Socket.io + Telegram ─────────────────────
matchingEngine.on('arbFound', (opp) => {
  addToStore(opp);
  io.emit('newOpportunity', opp);
  notifyArb(opp); // Telegram alert (silent if not configured)
  console.log(`[ARB] 🎯 Real arb emitted: ${opp.event} +${opp.arbPercentage?.toFixed(2)}% (${opp.strategy})`);
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected → ${opportunityStore.length} stored`);
  // Send top 100 sorted by arb% on connect
  const sorted = [...opportunityStore].sort((a, b) => (b.arbPercentage || 0) - (a.arbPercentage || 0));
  socket.emit('init', sorted.slice(0, 100));
  socket.emit('scraperStatus', scraperState);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected'));
});

// ─── Reload data every 30s ────────────────────────────────────────────────────
setInterval(() => {
  loadAllBookmakers();
  loadOrbitExchange();
}, 30 * 1000);

// ─── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  🎯 ArbiterX Backend  |  Port ${PORT}`);
  console.log(`  📡 http://localhost:${PORT}/api/opportunities`);
  console.log(`  ❤️   http://localhost:${PORT}/api/health`);
  console.log(`  🔍 http://localhost:${PORT}/api/scraper/status`);
  console.log(`${'═'.repeat(50)}\n`);

  // Load existing data immediately
  const hasData = loadAllBookmakers();
  loadOrbitExchange();

  // Start 300ms continuous arb scan
  startContinuousScan();

  // Start mock fallback
  startMockEngine();

  // Schedule all scrapers (runs immediately + every 3-5min)
  startScraperSchedule();

  if (hasData) {
    console.log('\n✅ REAL DATA ACTIVE — 300ms arb scan running\n');
  } else {
    console.log('\n⚠️  No fresh data yet. Scrapers starting in background...\n');
    console.log('  To get Baywin data: node scrapers/baywin.js');

    console.log('  To get all data:    node scrapers/manager.js\n');
  }
});
