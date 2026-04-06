const fs = require('fs');
const path = require('path');

async function scrapeOddspedia() {
  console.log('[Oddspedia] Fetching latest match polls from local Python API...');
  try {
    const res = await fetch('http://127.0.0.1:8000/match-poll/all?limit=10');
    const records = await res.json();
    
    let results = [];
    const seenEvents = new Set();
    
    records.forEach(record => {
      if (!record.success || !record.data || !record.data.data) return;
      const dataArr = record.data.data;
      
      dataArr.forEach(item => {
        if (!item.match) return;
        const eventName = `${item.match.ht} vs ${item.match.at}`;
        
        if (seenEvents.has(eventName)) return;
        seenEvents.add(eventName);

        const sport = item.match.sport_name || 'Soccer';
        const competition = item.match.league_name || 'Live';
        
        let homeOdds = null, drawOdds = null, awayOdds = null;
        let bookie = 'Oddspedia';
        
        const market100 = item.polls_by_market?.find(m => m.market_id === 100);
        if (market100 && market100.odds) {
          const home = market100.odds.find(o => o.odd_name === 'Home');
          const draw = market100.odds.find(o => o.odd_name === 'Draw');
          const away = market100.odds.find(o => o.odd_name === 'Away');
          
          if (home) homeOdds = parseFloat(home.value);
          if (draw) drawOdds = parseFloat(draw.value);
          if (away) awayOdds = parseFloat(away.value);
          if (home) bookie = home.bookie || 'Oddspedia';
        }
        
        if (homeOdds && awayOdds) {
          results.push({
            id: item.match.id || Math.random().toString(36).substr(2, 9),
            event: eventName,
            sport: sport,
            competition: competition,
            odds: drawOdds ? [homeOdds, drawOdds, awayOdds] : [homeOdds, awayOdds],
            bookmaker: bookie,
            isLive: item.match.is_match_current || false,
            scrapedAt: new Date().toISOString()
          });
        }
      });
    });

    if (results.length > 0) {
      const outPath = path.join(__dirname, '..', 'oddspedia_odds.json');
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
      console.log(`[Oddspedia] Saved ${results.length} events to oddspedia_odds.json`);
    } else {
      console.log('[Oddspedia] No relevant match odds found in local data.');
    }
  } catch (err) {
    console.error('[Oddspedia] Error:', err.message);
  }
}

if (require.main === module) {
  scrapeOddspedia();
}

module.exports = { scrapeOddspedia };
