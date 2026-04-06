/**
 * ArbiterX Database — SQLite via better-sqlite3
 *
 * Simple, synchronous SQLite for storing arbitrage opportunity history.
 * No ORM needed — raw SQL for maximum reliability.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create data directory if needed
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'arb.db');
const db = new Database(DB_PATH);

// Enable WAL for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS opportunities (
    id              TEXT PRIMARY KEY,
    event           TEXT NOT NULL,
    sport           TEXT NOT NULL DEFAULT 'Soccer',
    competition     TEXT NOT NULL DEFAULT 'Live',
    market          TEXT NOT NULL,
    selection       TEXT NOT NULL,
    arb_percentage  REAL NOT NULL,
    bookmaker       TEXT NOT NULL,
    bookmaker_odds  REAL NOT NULL,
    bookmaker_link  TEXT,
    exchanger       TEXT NOT NULL,
    exchanger_odds  REAL NOT NULL,
    exchanger_liq   REAL DEFAULT 0,
    exchanger_link  TEXT,
    is_live         INTEGER DEFAULT 1,
    is_real         INTEGER DEFAULT 0,
    source          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_opp_created ON opportunities(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_opp_event   ON opportunities(event);
  CREATE INDEX IF NOT EXISTS idx_opp_source  ON opportunities(source);
`);

// Prepared statements
const insertOpp = db.prepare(`
  INSERT OR IGNORE INTO opportunities
    (id, event, sport, competition, market, selection, arb_percentage,
     bookmaker, bookmaker_odds, bookmaker_link,
     exchanger, exchanger_odds, exchanger_liq, exchanger_link,
     is_live, is_real, source, created_at)
  VALUES
    (@id, @event, @sport, @competition, @market, @selection, @arb_percentage,
     @bookmaker, @bookmaker_odds, @bookmaker_link,
     @exchanger, @exchanger_odds, @exchanger_liq, @exchanger_link,
     @is_live, @is_real, @source, @created_at)
`);

const getRecent = db.prepare(`
  SELECT * FROM opportunities
  ORDER BY created_at DESC
  LIMIT ?
`);

const getBySource = db.prepare(`
  SELECT * FROM opportunities
  WHERE source = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const countAll = db.prepare(`SELECT COUNT(*) as count FROM opportunities`);
const countReal = db.prepare(`SELECT COUNT(*) as count FROM opportunities WHERE is_real = 1`);

/**
 * Save an opportunity to the database
 */
function saveOpportunity(opp) {
  try {
    insertOpp.run({
      id:               opp.id,
      event:            opp.event || '',
      sport:            opp.sport || 'Soccer',
      competition:      opp.competition || 'Live',
      market:           opp.market || 'Match Winner',
      selection:        opp.selection || 'Home',
      arb_percentage:   opp.arbPercentage || 0,
      bookmaker:        opp.bookmaker || '',
      bookmaker_odds:   opp.bookmakerOdds || 0,
      bookmaker_link:   opp.bookmakerLink || '',
      exchanger:        opp.exchanger || '',
      exchanger_odds:   opp.exchangerOdds || 0,
      exchanger_liq:    opp.exchangerLiquidity || 0,
      exchanger_link:   opp.exchangerLink || '',
      is_live:          opp.isLive ? 1 : 0,
      is_real:          opp.isReal ? 1 : 0,
      source:           opp.source || 'unknown',
      created_at:       opp.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    // Don't crash the server for DB errors
    if (!err.message.includes('UNIQUE')) {
      console.error('[DB] Error saving opportunity:', err.message);
    }
  }
}

/**
 * Get recent opportunities from DB
 */
function getOpportunities(limit = 100) {
  return getRecent.all(limit).map(row => ({
    id: row.id,
    event: row.event,
    sport: row.sport,
    competition: row.competition,
    market: row.market,
    selection: row.selection,
    arbPercentage: row.arb_percentage,
    bookmaker: row.bookmaker,
    bookmakerOdds: row.bookmaker_odds,
    bookmakerLink: row.bookmaker_link,
    exchanger: row.exchanger,
    exchangerOdds: row.exchanger_odds,
    exchangerLiquidity: row.exchanger_liq,
    exchangerLink: row.exchanger_link,
    isLive: row.is_live === 1,
    isReal: row.is_real === 1,
    source: row.source,
    createdAt: row.created_at,
  }));
}

/**
 * Get stats
 */
function getStats() {
  return {
    total: countAll.get().count,
    real: countReal.get().count,
    dbPath: DB_PATH,
  };
}

module.exports = { saveOpportunity, getOpportunities, getStats };
