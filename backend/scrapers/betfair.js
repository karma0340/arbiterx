/**
 * Betfair Exchange Scraper
 * 
 * Betfair has a documented Exchange API at https://api.betfair.com/exchange/betting/json-rpc/v1
 * This scraper uses both:
 * 1. The official Betfair Exchange API (if credentials are available)
 * 2. A Puppeteer fallback for public market prices
 * 
 * Key endpoints:
 * - listEventTypes: Get sport categories
 * - listEvents: Get upcoming/live events
 * - listMarketCatalogue: Get markets for events
 * - listMarketBook: Get current prices/odds for markets
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
require('dotenv').config({ path: '../.env' });

const BETFAIR_API_URL = 'https://api.betfair.com/exchange/betting/json-rpc/v1';
const BETFAIR_APP_KEY = process.env.BETFAIR_APP_KEY || '';
const BETFAIR_SESSION = process.env.BETFAIR_SESSION || '';

/**
 * Scrape Betfair via their JSON API (requires account if available)
 */
async function fetchBetfairViaAPI(sportId = '1') { // 1 = Soccer
  if (!BETFAIR_APP_KEY || !BETFAIR_SESSION) {
    console.log('[Betfair] No API credentials found. Using public scrape...');
    return scrapePublicBetfair();
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Application': BETFAIR_APP_KEY,
    'X-Authentication': BETFAIR_SESSION
  };

  try {
    // Step 1: List in-play events
    const eventsResp = await fetch(BETFAIR_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        jsonrpc: '2.0',
        method: 'SportsAPING/v1.0/listEvents',
        params: {
          filter: {
            eventTypeIds: [sportId],
            inPlayOnly: true
          }
        },
        id: 1
      }])
    });

    const eventsData = await eventsResp.json();
    const events = eventsData[0]?.result || [];
    console.log(`[Betfair API] Found ${events.length} live events`);

    // Step 2: For each event, get markets and best lay prices
    const results = [];
    for (const evt of events.slice(0, 10)) { // Limit to 10 for POC
      const eventId = evt.event.id;
      const eventName = evt.event.name;

      const mktResp = await fetch(BETFAIR_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify([{
          jsonrpc: '2.0',
          method: 'SportsAPING/v1.0/listMarketCatalogue',
          params: {
            filter: { eventIds: [eventId], marketTypeCodes: ['MATCH_ODDS'] },
            marketProjection: ['RUNNER_DESCRIPTION', 'EVENT'],
            maxResults: 1
          },
          id: 2
        }])
      });

      const mktData = await mktResp.json();
      const market = mktData[0]?.result?.[0];
      if (!market) continue;

      // Step 3: Get live prices
      const priceResp = await fetch(BETFAIR_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify([{
          jsonrpc: '2.0',
          method: 'SportsAPING/v1.0/listMarketBook',
          params: {
            marketIds: [market.marketId],
            priceProjection: { priceData: ['EX_BEST_OFFERS'] }
          },
          id: 3
        }])
      });

      const priceData = await priceResp.json();
      const book = priceData[0]?.result?.[0];
      if (!book) continue;

      book.runners.forEach((runner, i) => {
        const bestLay = runner.ex?.availableToLay?.[0];
        if (bestLay) {
          results.push({
            source: 'betfair',
            sport: 'Soccer',
            eventName,
            eventId,
            marketId: market.marketId,
            marketName: 'Match Odds',
            selection: market.runners?.[i]?.runnerName || `Runner ${i}`,
            layOdds: bestLay.price,
            layLiquidity: bestLay.size,
            link: `https://www.betfair.com/exchange/plus/football/market/${market.marketId}`,
            scrapedAt: new Date().toISOString()
          });
        }
      });
    }

    return results;
  } catch (err) {
    console.error('[Betfair API] Error:', err.message);
    return scrapePublicBetfair();
  }
}

/**
 * Fallback: Scrape public Betfair exchange page
 */
async function scrapePublicBetfair() {
  console.log('[Betfair] Scraping public exchange...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://www.betfair.com/sport/football', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.screenshot({ path: 'betfair_debug.png' });
    console.log('[Betfair] Debug screenshot saved.');

    // Extract any available market links for deep-linking
    const marketLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/exchange/plus/football/market"]').forEach(a => {
        links.push({
          text: a.innerText.trim(),
          href: a.href
        });
      });
      return links.slice(0, 20);
    });

    console.log(`[Betfair] Found ${marketLinks.length} market links.`);
    return marketLinks;
  } catch (err) {
    console.error('[Betfair] Scrape error:', err.message);
    return [];
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  fetchBetfairViaAPI().then(results => {
    console.log('[Betfair] Results:', JSON.stringify(results.slice(0, 3), null, 2));
  });
}

module.exports = { fetchBetfairViaAPI };
