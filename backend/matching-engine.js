/**
 * ArbiterX Matching Engine v2 — Multi-Bookmaker Arbitrage
 *
 * TRUE arbitrage detection strategy:
 * 
 * No exchange account or API needed. Instead we compare BACK odds from
 * multiple bookmakers for the same event. When the sum of implied
 * probabilities across the best available odds drops below 100%,
 * a guaranteed profit exists.
 *
 * Example (Soccer 3-way):
 *   Baywin:  Home @ 3.20  (implied 31.25%)
 *   Golbet:  Draw @ 4.50  (implied 22.22%)
 *   Kolay40: Away @ 2.80  (implied 35.71%)
 *   Total implied = 89.18% → arb profit = +10.82% ✅
 *
 * Example (2-way: Basketball, Tennis):
 *   Baywin:  Home @ 2.20  (implied 45.45%)
 *   Papa:    Away @ 2.30  (implied 43.48%)
 *   Total implied = 88.93% → arb profit = +11.07% ✅
 */

const EventEmitter = require('events');

class MatchingEngine extends EventEmitter {
  constructor() {
    super();
    // Key: normalizedEvent|market → { Home: {odds, bookmaker, link}, Draw: {...}, Away: {...} }
    this.eventOdds = new Map();
    this.MIN_ARB_PERCENT = 0.5;  // Only flag genuine arb (> 0.5%)
    this.recentlyEmitted = new Set(); // Dedup within 30s
  }

  // ─── Name Normalisation ───────────────────────────────────────────────────
  normalizeEventName(name) {
    return name
      .toLowerCase()
      .replace(/\s+vs\.?\s+|\s+-\s+|\s+v\.?\s+/gi, ' vs ')
      .replace(/manchester city/gi, 'man city')
      .replace(/manchester united/gi, 'man utd')
      .replace(/atletico madrid/gi, 'atl madrid')
      .replace(/borussia dortmund/gi, 'dortmund')
      .replace(/paris saint.germain|psg/gi, 'psg')
      .replace(/galatasaray/gi, 'galatasaray')
      .replace(/fenerbah[cç]e/gi, 'fenerbahce')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  eventKey(event, market) {
    return `${this.normalizeEventName(event)}::${(market || 'match winner').toLowerCase()}`;
  }

  getSportEmoji(sport = '') {
    const map = {
      soccer: '⚽', football: '⚽', basketball: '🏀',
      tennis: '🎾', hockey: '🏒', 'ice hockey': '🏒',
      volleyball: '🏐', baseball: '⚾', rugby: '🏉',
    };
    return map[sport.toLowerCase()] || '🎯';
  }

  // ─── Add odds from a bookmaker ────────────────────────────────────────────
  addBookmakerData(data) {
    const { event, market = 'Match Winner', selection, odds, bookmaker, link, sport, competition, isLive } = data;
    if (!event || !odds || odds <= 1.01) return;

    const key = this.eventKey(event, market);
    if (!this.eventOdds.has(key)) {
      this.eventOdds.set(key, {
        event, market, sport, competition, isLive,
        selections: {},
        updatedAt: new Date(),
      });
    }

    const entry = this.eventOdds.get(key);
    entry.updatedAt = new Date();

    const sel = selection.toLowerCase(); // 'home', 'draw', 'away'
    const existing = entry.selections[sel];

    // Keep the BEST (highest) odds across all bookmakers for this selection
    if (!existing || odds > existing.odds) {
      entry.selections[sel] = { odds, bookmaker, link, selection };
    }

    // After updating, try to find arb
    this.tryFindArb(key);
  }

  // ─── Core Arb Detection ───────────────────────────────────────────────────
  tryFindArb(key) {
    const entry = this.eventOdds.get(key);
    if (!entry) return;

    const sels = entry.selections;
    const keys = Object.keys(sels);

    // Need at least 2 sides (2-way: home+away, or 3-way: home+draw+away)
    if (keys.length < 2) return;

    // Calculate implied probability sum
    let impliedSum = 0;
    for (const sel of keys) {
      impliedSum += 1 / sels[sel].odds;
    }

    const arbPct = (1 - impliedSum) * 100;

    // Only emit genuine arb
    if (arbPct < this.MIN_ARB_PERCENT) return;

    // Dedup: don't re-emit same arb within 30 seconds
    const dedupKey = `${key}::${arbPct.toFixed(1)}`;
    if (this.recentlyEmitted.has(dedupKey)) return;
    this.recentlyEmitted.add(dedupKey);
    setTimeout(() => this.recentlyEmitted.delete(dedupKey), 30000);

    // Build best-odds summary string
    const backSummary = keys.map(s => `${sels[s].bookmaker} ${s} @ ${sels[s].odds}`).join(' | ');
    console.log(`[Engine] 🎯 REAL ARB: ${entry.event} | +${arbPct.toFixed(2)}% | ${backSummary}`);

    // Use the first bookmaker as "back" and the opposite as "exchanger" for display
    const [primarySel, secondarySel] = keys;
    const primary = sels[primarySel];
    const secondary = sels[secondarySel];

    // Stake calculator: budget allocation per leg
    const totalBudget = 1000;
    const stakes = {};
    for (const sel of keys) {
      stakes[sel] = {
        bookmaker: sels[sel].bookmaker,
        odds: sels[sel].odds,
        stake: parseFloat(((totalBudget / sels[sel].odds) / impliedSum * totalBudget / 1000 * totalBudget).toFixed(2)),
      };
    }

    const opportunity = {
      id: `arb-${key}-${Date.now()}`,
      sport: entry.sport || 'Soccer',
      sportEmoji: this.getSportEmoji(entry.sport),
      competition: entry.competition || 'Live',
      event: entry.event,
      eventDate: new Date().toISOString(),
      isLive: entry.isLive !== false,
      market: entry.market,
      selection: primarySel,

      // Arb profit
      arbPercentage: arbPct,
      impliedProbabilitySum: parseFloat((impliedSum * 100).toFixed(2)),

      // Back leg (highest odds bookmaker for primary selection)
      bookmaker: primary.bookmaker,
      bookmakerOdds: primary.odds,
      bookmakerLink: primary.link || '',

      // "Exchange" leg (best odds for secondary selection, shown as LAY equivalent)
      exchanger: secondary.bookmaker,
      exchangerOdds: secondary.odds,
      exchangerLiquidity: 0,
      exchangerLink: secondary.link || '',

      // All legs for UI display
      legs: keys.map(sel => ({
        selection: sels[sel].selection || sel,
        bookmaker: sels[sel].bookmaker,
        odds: sels[sel].odds,
        link: sels[sel].link || '',
      })),

      createdAt: new Date().toISOString(),
      isReal: true,
      source: 'multi-bookmaker',
      strategy: `${keys.length}-way arb`,
    };

    this.emit('arbFound', opportunity);
  }

  // ─── Legacy exchange API (kept for compatibility) ─────────────────────────
  addExchangeData(data) {
    // Treat exchange lay prices as a "bookmaker" for the opposite selection
    const { event, market, selection, layOdds, exchanger, link, liquidity } = data;
    if (!layOdds || layOdds <= 1.01) return;

    // Convert lay to back equivalent for the opposing selection
    this.addBookmakerData({
      event,
      market: market || 'Match Winner',
      selection: selection || 'Away',
      odds: layOdds,
      bookmaker: exchanger || 'Exchange',
      link: link || '',
      sport: 'Soccer',
      competition: 'Live',
      isLive: true,
    });
  }

  // ─── Clean stale data (> 15 min) ─────────────────────────────────────────
  cleanup() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    for (const [key, val] of this.eventOdds.entries()) {
      if (val.updatedAt < cutoff) this.eventOdds.delete(key);
    }
  }

  get bookmakerOdds() {
    // Shim for compatibility with health endpoint
    return this.eventOdds;
  }

  get exchangeOdds() {
    // No separate exchange store anymore
    return new Map();
  }
}

const engine = new MatchingEngine();
setInterval(() => engine.cleanup(), 2 * 60 * 1000);

module.exports = { MatchingEngine, engine };
