import type { ArbitrageOpportunity } from './types';

// Using static dates to prevent hydration errors.
export const mockOpportunities: ArbitrageOpportunity[] = [
  {
    id: '1',
    eventName: 'Manchester United vs. Liverpool',
    league: 'Premier League',
    market: 'Match Odds',
    profitPercentage: 4.2,
    eventDate: new Date('2024-08-20T18:00:00Z'),
    outcomes: [
      {
        name: 'Man Utd to Win',
        bookmakers: [{ name: 'OrbitX', odds: 2.5 }],
      },
      {
        name: 'Draw',
        bookmakers: [{ name: 'SkySprops', odds: 3.8 }],
      },
      {
        name: 'Liverpool to Win',
        bookmakers: [{ name: '365Scores', odds: 3.1 }],
      },
    ],
  },
  {
    id: '2',
    eventName: 'LA Lakers vs. Boston Celtics',
    league: 'NBA',
    market: 'Total Points (Over/Under 220.5)',
    profitPercentage: 2.8,
    eventDate: new Date('2024-08-21T23:30:00Z'),
    outcomes: [
      {
        name: 'Over 220.5',
        bookmakers: [{ name: 'OrbitX', odds: 1.95 }],
      },
      {
        name: 'Under 220.5',
        bookmakers: [{ name: 'Betfair', odds: 2.1 }],
      },
    ],
  },
  {
    id: '3',
    eventName: 'Real Madrid vs. Barcelona',
    league: 'La Liga',
    market: 'Both Teams to Score',
    profitPercentage: 5.1,
    eventDate: new Date('2024-08-25T19:00:00Z'),
    outcomes: [
      {
        name: 'Yes',
        bookmakers: [{ name: 'Pinnacle', odds: 1.8 }],
      },
      {
        name: 'No',
        bookmakers: [{ name: 'OrbitX', odds: 2.4 }],
      },
    ],
  },
  {
    id: '4',
    eventName: 'Kansas City Chiefs vs. Philadelphia Eagles',
    league: 'NFL',
    market: 'Handicap (-3.5)',
    profitPercentage: 3.5,
    eventDate: new Date('2024-09-01T20:15:00Z'),
    outcomes: [
      {
        name: 'Chiefs -3.5',
        bookmakers: [{ name: 'SkySprops', odds: 2.0 }],
      },
      {
        name: 'Eagles +3.5',
        bookmakers: [{ name: '365Scores', odds: 2.05 }],
      },
    ],
  },
    {
    id: '5',
    eventName: 'AC Milan vs. Inter Milan',
    league: 'Serie A',
    market: 'Match Odds',
    profitPercentage: 1.9,
    eventDate: new Date('2024-08-23T18:45:00Z'),
    outcomes: [
      {
        name: 'AC Milan to Win',
        bookmakers: [{ name: 'OrbitX', odds: 3.2 }],
      },
      {
        name: 'Draw',
        bookmakers: [{ name: 'Betfair', odds: 3.4 }],
      },
      {
        name: 'Inter Milan to Win',
        bookmakers: [{ name: 'Pinnacle', odds: 2.4 }],
      },
    ],
  },
  {
    id: '6',
    eventName: 'Golden State Warriors vs. Denver Nuggets',
    league: 'NBA',
    market: 'Money Line',
    profitPercentage: 3.1,
    eventDate: new Date('2024-08-24T02:00:00Z'),
    outcomes: [
      {
        name: 'Warriors',
        bookmakers: [{ name: '365Scores', odds: 2.15 }],
      },
      {
        name: 'Nuggets',
        bookmakers: [{ name: 'OrbitX', odds: 1.85 }],
      },
    ],
  },
];
