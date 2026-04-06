'use client';

import type { ArbOpportunity } from '@/lib/types';
import { ExternalLink, Trash2, AlertTriangle, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState, useMemo } from 'react';

interface OpportunityCardProps {
  opportunity: ArbOpportunity;
  onDismiss?: (id: string) => void;
  isNew?: boolean;
  defaultStake?: number;
}

function ArbBadge({ pct }: { pct: number }) {
  const getStyle = () => {
    if (pct >= 4) return 'bg-red-500/20 text-red-400 border-red-500/40';
    if (pct >= 2) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return 'bg-green-500/20 text-green-400 border-green-500/40';
  };
  return (
    <div className={`px-2 py-1 rounded-md border text-xs font-bold tabular-nums ${getStyle()}`}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </div>
  );
}

/**
 * Stake Calculator
 * Given a total budget, calculates optimal stake per leg guaranteeing profit.
 *
 * Formula: stake_i = (budget / odds_i) / sum(1/odds_j)
 * Profit  = budget × (1 - implied_sum) / implied_sum
 */
function StakeCalculator({ op, defaultStake }: { op: ArbOpportunity; defaultStake: number }) {
  const [budget, setBudget] = useState(defaultStake);

  const legs = useMemo(() => {
    // Use legs array if available (3-way), otherwise 2-way
    const raw = (op as any).legs;
    if (raw && raw.length >= 2) return raw;
    return [
      { selection: op.selection || 'Back', bookmaker: op.bookmaker, odds: op.bookmakerOdds, link: op.bookmakerLink },
      { selection: 'Counter',              bookmaker: op.exchanger,  odds: op.exchangerOdds, link: op.exchangerLink },
    ];
  }, [op]);

  const impliedSum = useMemo(
    () => legs.reduce((s: number, l: any) => s + (l.odds > 1 ? 1 / l.odds : 0), 0),
    [legs]
  );

  const isArb = impliedSum < 1 && impliedSum > 0;
  const profit = isArb ? ((1 - impliedSum) / impliedSum * budget) : 0;

  const stakes = useMemo(() =>
    legs.map((l: any) => ({
      ...l,
      stake: isArb ? (budget / l.odds) / impliedSum : 0,
    })),
    [legs, budget, impliedSum, isArb]
  );

  return (
    <div className="mt-2.5 pt-2.5 border-t border-[hsl(222_30%_16%)]">
      {/* Budget input */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Stake Calculator</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">€</span>
          <input
            type="number"
            value={budget}
            onChange={e => setBudget(Math.max(1, parseInt(e.target.value) || 100))}
            className="w-20 bg-[hsl(222_47%_6%)] border border-[hsl(222_30%_18%)] rounded px-2 py-0.5 text-xs text-white tabular-nums text-right focus:outline-none focus:border-primary/50"
            min={1}
            step={100}
          />
        </div>
      </div>

      {/* Legs */}
      <div className="space-y-1">
        {stakes.map((leg: any, i: number) => (
          <a
            key={i}
            href={leg.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => { if (!leg.link) e.preventDefault(); }}
            className="flex items-center justify-between bg-[hsl(222_47%_6%)] rounded px-2 py-1.5 group hover:bg-[hsl(222_47%_7%)] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-gray-500 uppercase w-12 shrink-0">{leg.selection}</span>
              <span className="text-[11px] text-gray-400 truncate">{leg.bookmaker}</span>
              <span className="text-[11px] text-white font-bold tabular-nums">@ {leg.odds?.toFixed ? leg.odds.toFixed(2) : leg.odds}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-white tabular-nums">€{leg.stake.toFixed(2)}</span>
              {leg.link && <ExternalLink className="h-2.5 w-2.5 text-gray-600 group-hover:text-gray-400" />}
            </div>
          </a>
        ))}
      </div>

      {/* Profit */}
      <div className={`flex items-center justify-between mt-2 px-2 py-1.5 rounded ${isArb ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
        <span className="text-[10px] text-gray-400">
          {isArb ? 'Guaranteed profit' : 'No arb (odds drifted)'}
        </span>
        <span className={`text-sm font-bold tabular-nums ${isArb ? 'text-green-400' : 'text-red-400'}`}>
          {isArb ? `+€${profit.toFixed(2)}` : '—'}
        </span>
      </div>
    </div>
  );
}

export function OpportunityCard({ opportunity: op, onDismiss, isNew, defaultStake = 1000 }: OpportunityCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.(op.id);
  };

  let eventTime = '';
  try { eventTime = format(parseISO(op.eventDate), 'HH:mm'); } catch { eventTime = '--:--'; }

  return (
    <div
      className={`
        relative border rounded-lg p-3 transition-all duration-200 cursor-default
        ${isNew ? 'flash-new' : ''}
        border-[hsl(222_30%_18%)] bg-[hsl(222_47%_9%)]
        hover:border-[hsl(212_100%_55%_/_30%)] hover:bg-[hsl(222_47%_10%)]
      `}
    >
      {/* Top row: Sport icon + Event name + Arb % */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-base leading-5 shrink-0 mt-0.5">{op.sportEmoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">{op.event}</p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{op.competition}</p>
          </div>
        </div>
        <ArbBadge pct={op.arbPercentage} />
      </div>

      {/* Market + Selection */}
      <a
        href={op.bookmakerLink || op.exchangerLink || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2.5 block group/market"
      >
        <p className="text-[11px] text-gray-500 group-hover/market:text-gray-400 transition-colors">{op.market}</p>
        <p className="text-xs text-blue-400 font-medium mt-0.5 group-hover/market:underline">{op.selection}</p>
      </a>

      {/* Odds comparison */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        {/* Bookmaker (Back) */}
        <a
          href={op.bookmakerLink || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[hsl(222_47%_6%)] rounded-md p-2 border border-[hsl(222_30%_14%)] hover:border-primary/40 transition-colors block"
          onClick={(e) => { if (!op.bookmakerLink) e.preventDefault(); }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">BACK</span>
            {op.bookmakerLink && <ExternalLink className="h-2.5 w-2.5 text-gray-600" />}
          </div>
          <p className="text-lg font-bold text-white tabular-nums">{op.bookmakerOdds.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 truncate">{op.bookmaker}</p>
        </a>

        {/* Exchanger / Counter */}
        <a
          href={op.exchangerLink || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[hsl(222_47%_6%)] rounded-md p-2 border border-[hsl(222_30%_14%)] hover:border-primary/40 transition-colors block"
          onClick={(e) => { if (!op.exchangerLink) e.preventDefault(); }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
              {(op as any).strategy?.includes('3-way') ? 'BEST' : 'LAY'}
            </span>
            {op.exchangerLink && <ExternalLink className="h-2.5 w-2.5 text-gray-600" />}
          </div>
          <p className="text-lg font-bold text-white tabular-nums">{op.exchangerOdds.toFixed(2)}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-gray-500">{op.exchanger}</p>
            {op.exchangerLiquidity ? (
              <span className="text-[9px] text-gray-600">€{op.exchangerLiquidity}</span>
            ) : null}
          </div>
        </a>
      </div>

      {/* Expandable Stake Calculator */}
      {showCalc && <StakeCalculator op={op} defaultStake={defaultStake} />}

      {/* Footer: time + badges + actions */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {op.isLive ? (
            <span className="arb-badge-live flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse inline-block" />
              LIVE
            </span>
          ) : (
            <span className="arb-badge-prematch">PREMATCH</span>
          )}
          {op.isReal ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-red-500/15 text-red-400 border border-red-500/30"
              title={`Real data from ${op.source || op.bookmaker}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
              REAL
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-gray-600/20 text-gray-500 border border-gray-600/30">
              DEMO
            </span>
          )}
          <span className="text-[10px] text-gray-600">{eventTime}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Calculator toggle */}
          <button
            onClick={() => setShowCalc(v => !v)}
            className={`p-1 rounded transition-colors ${showCalc ? 'text-blue-400 bg-blue-500/10' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'}`}
            title="Stake Calculator"
          >
            {showCalc
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <Calculator className="h-3.5 w-3.5" />
            }
          </button>
          <button
            className="p-1 rounded text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Report error"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Dismiss"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
