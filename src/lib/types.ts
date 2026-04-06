// ArbitrageX Pro - Exact data model matching the "new:arb" WebSocket event
export type ArbOpportunity = {
  id: string;
  sport: string;          // "football", "basketball", "tennis", etc.
  sportEmoji: string;     // "⚽", "🏀", "🎾"
  competition: string;    // "Spanish La Liga", "NBA", etc.
  event: string;          // "Team A vs Team B"
  eventDate: string;      // ISO date string
  isLive: boolean;
  market: string;         // "Over/Under 3.5 Goals", "Asian Handicap"
  selection: string;      // "Over 3.5 Goals"
  arbPercentage: number;  // e.g., 1.44
  // Bookmaker (back bet)
  bookmaker: string;      // "Golbet"
  bookmakerOdds: number;  // 1.76
  bookmakerLink?: string;
  // Exchanger (lay bet)
  exchanger: string;      // "Betfair"
  exchangerOdds: number;  // 1.71
  exchangerLiquidity?: number; // e.g., 130 (available to lay)
  exchangerLink?: string;
  // Data source metadata
  isReal?: boolean;       // true = real scraped data, false = mock/demo
  source?: string;        // 'baywin' | 'golbet' | 'papa' | 'kolay40' | 'mock'
};

// Arb % = (1 - 1/backOdds - 1/layOdds) * 100
export function calcArbPercentage(backOdds: number, layOdds: number): number {
  return (1 - 1 / backOdds - 1 / layOdds) * 100;
}

// Stake calculator
export function calcStakes(totalBudget: number, backOdds: number, layOdds: number) {
  const sum = 1 / backOdds + 1 / layOdds;
  const stake1 = totalBudget * (1 / backOdds) / sum;
  const stake2 = totalBudget * (1 / layOdds) / sum;
  const profit = totalBudget * (1 - sum);
  return { stake1, stake2, profit };
}

// Legacy types (kept for any remaining usage)
export type BookmakerOdd = { name: string; odds: number };
export type ArbitrageOutcome = { name: string; bookmakers: BookmakerOdd[] };
export type ArbitrageOpportunity = {
  id: string;
  eventName: string;
  league: string;
  market: string;
  profitPercentage: number;
  eventDate: Date;
  outcomes: ArbitrageOutcome[];
};
