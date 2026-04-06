'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';

interface HistoryOpportunity {
  id: string;
  event: string;
  sport: string;
  competition: string;
  market: string;
  arbPercentage: number;
  bookmaker: string;
  bookmakerOdds: number;
  exchanger: string;
  exchangerOdds: number;
  isReal: boolean;
  source: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:4000/api/history?limit=${limit}`)
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  const totalReal = history.filter(h => h.isReal).length;
  const avgArb = history.length ? (history.reduce((s, h) => s + (h.arbPercentage || 0), 0) / history.length).toFixed(2) : '0';
  const best = history.length ? Math.max(...history.map(h => h.arbPercentage || 0)).toFixed(2) : '0';

  return (
    <div className="min-h-screen bg-[hsl(222_47%_7%)] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">📊 Opportunity History</h1>
          <p className="text-gray-500 text-sm">All arbitrage opportunities detected and stored in the database.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Stored', value: history.length, color: 'text-blue-400' },
            { label: 'Real Data', value: totalReal, color: 'text-green-400' },
            { label: 'Avg Arb %', value: `+${avgArb}%`, color: 'text-amber-400' },
            { label: 'Best Arb %', value: `+${best}%`, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-[hsl(222_47%_9%)] border border-[hsl(222_30%_18%)] rounded-lg p-4">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[hsl(222_47%_9%)] border border-[hsl(222_30%_18%)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(222_30%_18%)]">
            <span className="text-sm font-semibold text-gray-300">Opportunity Log</span>
            <select
              className="bg-[hsl(222_47%_6%)] border border-[hsl(222_30%_18%)] rounded px-2 py-1 text-xs text-gray-300"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={250}>Last 250</option>
              <option value={500}>Last 500</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No history yet. Opportunities will appear here as they are detected.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-[hsl(222_30%_18%)]">
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Event</th>
                    <th className="text-left px-4 py-2">Market</th>
                    <th className="text-right px-4 py-2">Arb %</th>
                    <th className="text-left px-4 py-2">Back</th>
                    <th className="text-left px-4 py-2">Lay</th>
                    <th className="text-center px-4 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr
                      key={h.id}
                      className={`border-b border-[hsl(222_30%_16%)] transition-colors hover:bg-[hsl(222_47%_10%)] ${i % 2 === 0 ? '' : 'bg-[hsl(222_47%_8%)]'}`}
                    >
                      <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums whitespace-nowrap">
                        {(() => { try { return format(parseISO(h.createdAt), 'MM/dd HH:mm'); } catch { return '--'; } })()}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-white text-xs font-medium truncate max-w-[200px]">{h.event}</p>
                        <p className="text-gray-500 text-[10px]">{h.competition}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{h.market}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-bold tabular-nums text-xs ${(h.arbPercentage || 0) > 5 ? 'text-red-400' : (h.arbPercentage || 0) > 2 ? 'text-amber-400' : 'text-green-400'}`}>
                          {(h.arbPercentage || 0) >= 0 ? '+' : ''}{(h.arbPercentage || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="text-white font-medium">{h.bookmakerOdds?.toFixed(2)}</span>
                        <span className="text-gray-500 ml-1">@{h.bookmaker}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="text-white font-medium">{h.exchangerOdds?.toFixed(2)}</span>
                        <span className="text-gray-500 ml-1">@{h.exchanger}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {h.isReal ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="h-1 w-1 rounded-full bg-red-400 inline-block" /> REAL
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-600/20 text-gray-500 border border-gray-600/30">DEMO</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
