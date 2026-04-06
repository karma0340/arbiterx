/**
 * Baywin Live Data Extractor — Runtime.evaluate on Open Chrome Tab
 *
 * Since headless Puppeteer can't render the sportsbook widget,
 * we use the existing open Chrome browser (which CAN render it).
 *
 * Steps:
 * 1. Connect to Chrome via CDP (remote debugging port 9222)
 * 2. Find the Baywin tab
 * 3. Get list of all execution contexts (including cross-origin iframe contexts)
 * 4. Run JS in each context to find the one with live betting data
 * 5. Extract match names and odds from the DOM
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9222;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function cdpCmd(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e7);
    const handler = (msg) => {
      const d = JSON.parse(msg);
      if (d.id !== id) return;
      ws.off('message', handler);
      if (d.error) reject(new Error(d.error.message));
      else resolve(d.result);
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function extractFromContext(ws, contextId, label) {
  const expr = `
    (function() {
      const results = [];
      
      // Try many different selectors for match data
      const allText = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0) {
          const t = el.textContent.trim();
          if (t.length > 2 && t.length < 60) allText.push(t);
        }
      });
      
      // Look for score patterns: "1 : 0", "2 - 1"
      const scorePattern = /^\\d+[\\s]*[:\\-][\\s]*\\d+$/;
      const oddsPattern = /^\\d+\\.\\d{1,2}$/;
      
      const scores = allText.filter(t => scorePattern.test(t));
      const odds = allText.filter(t => oddsPattern.test(t)).map(Number).filter(n => n >= 1.01 && n <= 100);
      
      // Look for vs patterns in text
      const allParagraphs = Array.from(document.querySelectorAll('span, div, p'))
        .map(el => el.textContent?.trim()).filter(t => t && t.includes(' vs ') || (t && t.includes(' - ') && t.length < 50 && t.length > 10));
      
      return {
        contextId: ${contextId},
        label: ${JSON.stringify(label)},
        url: location.href,
        title: document.title,
        textCount: allText.length,
        scores,
        odds: odds.slice(0, 20),
        vsMatches: allParagraphs.slice(0, 10),
        htmlLength: document.body?.innerHTML.length || 0,
        hasContent: document.body?.innerHTML.length > 5000,
      };
    })()
  `;
  
  try {
    const { result } = await cdpCmd(ws, 'Runtime.evaluate', {
      expression: expr,
      contextId,
      returnByValue: true,
    });
    return result?.value;
  } catch (e) {
    return { contextId, error: e.message };
  }
}

async function main() {
  const targets = await getTargets();
  const baywinTarget = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  
  if (!baywinTarget) {
    console.log('❌ No Baywin tab open. Please open https://355baywin.com/tr-tr/live in Chrome.');
    return;
  }
  
  console.log(`✅ Found: ${baywinTarget.url.substring(0, 60)}`);
  
  const ws = new WebSocket(baywinTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  // Enable runtime to get all execution contexts
  await cdpCmd(ws, 'Runtime.enable');
  await cdpCmd(ws, 'Page.enable');

  // Get all frames
  const { frameTree } = await cdpCmd(ws, 'Page.getFrameTree');
  
  const frames = [];
  const collectFrames = (tree) => {
    frames.push(tree.frame);
    (tree.childFrames || []).forEach(collectFrames);
  };
  collectFrames(frameTree);
  
  console.log(`\n📋 Frames (${frames.length}):`);
  frames.forEach(f => console.log(`  [${f.id.substring(0, 8)}] ${f.url.substring(0, 80)}`));

  // Get all execution contexts
  const contexts = [];
  const contextHandler = (params) => {
    if (params.context) contexts.push(params.context);
  };
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.method === 'Runtime.executionContextCreated') contextHandler(m.params);
    } catch (_) {}
  });

  // Trigger context enumeration
  await cdpCmd(ws, 'Runtime.enable');
  await new Promise(r => setTimeout(r, 1000));

  console.log(`\n🎯 Execution contexts: ${contexts.length}`);
  contexts.forEach(c => console.log(`  [${c.id}] ${c.origin} "${c.name}"`));

  // Try extracting from each context
  console.log('\n📊 Extracting match data from each context...\n');
  const results = [];
  
  for (const ctx of contexts) {
    const data = await extractFromContext(ws, ctx.id, ctx.origin);
    if (data && !data.error && data.htmlLength > 1000) {
      console.log(`\n[Context ${ctx.id}] ${ctx.origin.substring(0, 50)}`);
      console.log(`  HTML size: ${data.htmlLength} | Text nodes: ${data.textCount}`);
      console.log(`  Odds found: ${data.odds.join(', ')}`);
      console.log(`  VS matches: ${JSON.stringify(data.vsMatches.slice(0, 3))}`);
      results.push(data);
    }
  }

  // Also try the default context (main page)
  const mainData = await cdpCmd(ws, 'Runtime.evaluate', {
    expression: `({
      url: location.href,
      iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({src: f.src, width: f.width, height: f.height})),
      innerFrameContents: Array.from(document.querySelectorAll('iframe')).map(f => {
        try { return f.contentDocument?.body?.innerHTML?.length || 0; } catch(e) { return 'cross-origin'; }
      })
    })`,
    returnByValue: true,
  });
  
  console.log('\n🖼️ Iframes in main page:', JSON.stringify(mainData.result?.value, null, 2));

  ws.close();
  
  // Find the context with odds (sportsbook widget)
  const sportsbookContext = results.find(r => r.odds && r.odds.length > 3);
  if (sportsbookContext) {
    console.log('\n✅ Found sportsbook context with odds!', sportsbookContext.odds);
    fs.writeFileSync(path.join(__dirname, '..', 'baywin_contexts.json'), JSON.stringify(results, null, 2));
  } else {
    console.log('\n⚠️ No context with odds found');
    fs.writeFileSync(path.join(__dirname, '..', 'baywin_contexts.json'), JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);
