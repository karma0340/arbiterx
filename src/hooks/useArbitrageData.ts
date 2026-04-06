'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { ArbOpportunity } from '@/lib/types';
import { io, Socket } from 'socket.io-client';

const LOGIN_URL = 'https://login.arbitragex.pro/login';
const WS_URL = 'http://localhost:4000';

// Sport emoji map
const SPORT_EMOJIS: Record<string, string> = {
  football: '⚽', soccer: '⚽',
  basketball: '🏀', tennis: '🎾',
  baseball: '⚾', hockey: '🏒',
  volleyball: '🏐', rugby: '🏉',
  boxing: '🥊', mma: '🥋',
  default: '🎯',
};

function getSportEmoji(sport: string): string {
  return SPORT_EMOJIS[sport?.toLowerCase()] || SPORT_EMOJIS.default;
}

// Convert raw WebSocket payload to our ArbOpportunity type
// Handles both old format (back_odds/lay_odds) and new format (bookmakerOdds/exchangerOdds)
function mapRawToOpportunity(raw: Record<string, unknown>): ArbOpportunity {
  const backOdds = Number(raw.bookmakerOdds || raw.back_odds || raw.backOdds || 0);
  const layOdds = Number(raw.exchangerOdds || raw.lay_odds || raw.layOdds || 0);
  const arbPct = Number(raw.arbPercentage || raw.arb_percentage || 
    (backOdds && layOdds ? Math.abs((1 - 1/backOdds - 1/layOdds) * 100) : 0));
  const sport = String(raw.sport || 'football');
  
  return {
    id: String(raw.id || raw._id || Math.random().toString(36).slice(2)),
    sport: sport.toLowerCase(),
    sportEmoji: String(raw.sportEmoji || getSportEmoji(sport)),
    competition: String(raw.competition || raw.league || raw.tournament || ''),
    event: String(raw.event || raw.teams || raw.eventName || ''),
    eventDate: String(raw.eventDate || raw.event_date || raw.date || new Date().toISOString()),
    isLive: raw.isLive === true || raw.is_live === true || raw.live === true,
    market: String(raw.market || raw.marketName || 'Match Winner'),
    selection: String(raw.selection || raw.outcome || raw.pick || 'Home'),
    arbPercentage: arbPct,
    bookmaker: String(raw.bookmaker || raw.back_bookmaker || raw.backProvider || ''),
    bookmakerOdds: backOdds,
    bookmakerLink: String(raw.bookmakerLink || raw.back_link || ''),
    exchanger: String(raw.exchanger || raw.lay_exchanger || raw.layProvider || 'Betfair'),
    exchangerOdds: layOdds,
    exchangerLiquidity: Number(raw.exchangerLiquidity || raw.lay_liquidity || raw.liquidity || 0),
    exchangerLink: String(raw.exchangerLink || raw.lay_link || ''),
    isReal: raw.isReal === true,
    source: String(raw.source || ''),
  };
}

// Demo fallback data (used when not connected)
function generateDemoOpportunity(index: number): ArbOpportunity {
  const events = [
    { event: 'Mutondo Stars vs Nkana', competition: 'Zambian Super Division', sport: 'football', market: 'Match Result', selection: 'Home', back: 7.60, lay: 6.60 },
    { event: 'Quepos Cambute vs AD Sarchi', competition: 'Costa Rican Ascenso', sport: 'football', market: 'First Half Goals 1.5', selection: 'Over 1.5', back: 2.45, lay: 2.14 },
    { event: 'Dumbarton vs Stranraer', competition: 'Scottish League One', sport: 'football', market: 'Both Teams Score', selection: 'Yes', back: 2.50, lay: 2.28 },
    { event: 'Galatasaray vs Liverpool', competition: 'UEFA Champions League', sport: 'football', market: 'Asian Handicap -0.5', selection: 'Liverpool -0.5', back: 1.95, lay: 1.85 },
    { event: 'Lakers vs Celtics', competition: 'NBA Regular Season', sport: 'basketball', market: 'Total Points', selection: 'Over 215.5', back: 2.02, lay: 1.94 },
    { event: 'Alcaraz vs Sinner', competition: 'ATP Masters 1000', sport: 'tennis', market: 'Match Winner', selection: 'Sinner', back: 2.30, lay: 2.15 },
    { event: 'Man City vs Arsenal', competition: 'English Premier League', sport: 'football', market: 'Match Result', selection: 'Draw', back: 3.40, lay: 3.20 },
    { event: 'Fluminense vs Flamengo', competition: 'Brazilian Serie A', sport: 'football', market: 'Asian Handicap', selection: 'Flamengo +0.5', back: 1.88, lay: 1.78 },
  ];
  const data = events[index % events.length];
  const arbPct = (1 - 1/data.back - 1/data.lay) * 100;
  const bookmakers = ['Golbet', 'Papa', 'Kolay40', 'Baywin', 'Betboo'];
  return {
    id: `demo-${index}-${Date.now()}`,
    sport: data.sport,
    sportEmoji: getSportEmoji(data.sport),
    competition: data.competition,
    event: data.event,
    eventDate: new Date(Date.now() + (index * 3600000)).toISOString(),
    isLive: index % 3 === 0,
    market: data.market,
    selection: data.selection,
    arbPercentage: Math.abs(arbPct),
    bookmaker: bookmakers[index % bookmakers.length],
    bookmakerOdds: data.back,
    bookmakerLink: '',
    exchanger: 'Betfair',
    exchangerOdds: data.lay,
    exchangerLiquidity: 50 + Math.floor(Math.random() * 200),
    exchangerLink: '',
  };
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'demo';

export function useArbitrageData() {
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const demoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const demoIndexRef = useRef(0);

  const startDemoMode = useCallback(() => {
    setStatus('demo');
    setIsLoading(false);
    
    // Load initial batch of demo data
    const initialData = Array.from({ length: 12 }, (_, i) => generateDemoOpportunity(i));
    setOpportunities(initialData);
    demoIndexRef.current = 12;

    // High-frequency simulation function
    const nextTick = () => {
      const newOpp = generateDemoOpportunity(demoIndexRef.current++);
      setOpportunities(prev => [newOpp, ...prev].slice(0, 50));
      
      // Schedule next update at a random millisecond interval (100ms - 1200ms)
      const delay = 100 + Math.random() * 1100;
      demoTimeoutRef.current = setTimeout(nextTick, delay);
    };

    demoTimeoutRef.current = setTimeout(nextTick, 500);
  }, []);

  const connectWS = useCallback(async () => {
    setStatus('connecting');
    setIsLoading(true);
    
    try {
      // Connect to real backend regardless of auth status
      // Auth token is optional — pass if available
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

      // Socket.IO optimized for low-latency
      const socket = io(WS_URL, {
        ...(token ? { auth: { token } } : {}),
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 8000,
        forceNew: true
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[ArbitrageX] 🔴 Live data connected to real backend ✅');
        setStatus('connected');
        setIsLoading(false);
      });

      // Handle individual or batched high-frequency updates
      const handleData = (data: any) => {
        const items = Array.isArray(data) ? data : [data];
        if (items.length === 0) return;
        
        const mapped = items.map(mapRawToOpportunity);
        setOpportunities(prev => {
          // Merge and keep the most recent 100
          const combined = [...mapped, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.slice(0, 100);
        });
      };

      socket.on('init', handleData);
      socket.on('newOpportunity', handleData);

      socket.on('disconnect', () => {
        setStatus('disconnected');
      });

      socket.on('connect_error', (err) => {
        console.warn('[ArbitrageX] WS connect error, falling back to demo:', err.message);
        socket.disconnect();
        startDemoMode();
      });

    } catch (err) {
      console.error('[ArbitrageX] WS connect error:', err);
      startDemoMode();
    }
  }, [startDemoMode]);

  useEffect(() => {
    connectWS();
    return () => {
      socketRef.current?.disconnect();
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, []);

  const clearOpportunities = useCallback(() => {
    setOpportunities([]);
  }, []);

  return { opportunities, status, isLoading, clearOpportunities };
}
