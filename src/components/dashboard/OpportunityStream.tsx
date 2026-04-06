'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useArbitrageData } from '@/hooks/useArbitrageData';
import { useArbAlerts } from '@/hooks/useArbAlerts';
import { OpportunityCard } from './OpportunityCard';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { ArbSettingsPanel } from './ArbSettingsPanel';
import type { ArbOpportunity } from '@/lib/types';
import {
  SlidersHorizontal, Percent, X, TrendingUp, ArrowUpDown,
  Loader2, ExternalLink, Zap, Clock, Grid2X2, Table,
  ChevronDown, ChevronUp, Settings
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_SPORTS = [
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '🎾', name: 'Tennis' },
  { emoji: '🏒', name: 'Ice Hockey' },
  { emoji: '🏈', name: 'American Football' },
  { emoji: '🏐', name: 'Volleyball' },
  { emoji: '🥊', name: 'Boxing' },
  { emoji: '🏏', name: 'Cricket' },
];

const ALL_BOOKMAKERS = ['Baywin', 'Golbet', 'Papa', 'Kolay40'];
const ALL_EXCHANGES = ['Betfair', 'Orbit', 'SharpX', 'B33M', 'Laystars', 'PiWi'];

const ALL_MARKETS = [
  'Match Odds', 'Over/Under 2.5', 'Both Teams Score', 'Asian Handicap',
  'First Half Goals 1.5', 'Double Chance', 'Draw No Bet', 'Moneyline',
  'Total Points', '60 Minute 3-Way', 'Match Winner',
];

// ─── Filter State ─────────────────────────────────────────────────────────────

interface Filters {
  sports: string[];
  bookmakers: string[];
  exchanges: string[];
  markets: string[];
  minArb: number;
  maxArb: number;
  liveOnly: boolean;
  prematchOnly: boolean;
  minOdds: number;
  maxOdds: number;
}

const DEFAULT_FILTERS: Filters = {
  sports: [],
  bookmakers: [],
  exchanges: [],
  markets: [],
  minArb: -100,
  maxArb: 30,
  liveOnly: false,
  prematchOnly: false,
  minOdds: 1,
  maxOdds: 50,
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 text-xs text-gray-400 uppercase tracking-wider font-medium hover:text-white transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? 'bg-blue-600/30 border-blue-500/60 text-blue-300 shadow-sm shadow-blue-500/20'
          : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function FilterPanel({ open, onClose, filters, onChange, availableBookmakers = ALL_BOOKMAKERS, availableExchanges = ALL_EXCHANGES }: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  availableBookmakers?: string[];
  availableExchanges?: string[];
}) {
  if (!open) return null;

  const set = useCallback((patch: Partial<Filters>) => onChange({ ...filters, ...patch }), [filters, onChange]);

  const toggleList = (key: keyof Filters, val: string) => {
    const list = filters[key] as string[];
    set({ [key]: list.includes(val) ? list.filter(x => x !== val) : [...list, val] });
  };

  const activeCount =
    filters.sports.length + filters.bookmakers.length + filters.exchanges.length +
    filters.markets.length + (filters.liveOnly ? 1 : 0) + (filters.prematchOnly ? 1 : 0) +
    (filters.minArb > 0 ? 1 : 0) + (filters.minOdds > 1 ? 1 : 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed left-0 top-0 bottom-0 w-72 z-50 flex flex-col overflow-hidden"
        style={{ backgroundColor: 'hsl(222 47% 7%)', borderRight: '1px solid hsl(222 30% 14%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(222_30%_14%)]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-400" />
            <h2 className="text-white font-semibold text-sm">Filters</h2>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                {activeCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 divide-y divide-[hsl(222_30%_12%)]">

          {/* Live / Prematch Toggle */}
          <FilterSection title="Match Type">
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => set({ liveOnly: !filters.liveOnly, prematchOnly: false })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filters.liveOnly
                    ? 'bg-green-600/20 border-green-500/40 text-green-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${filters.liveOnly ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                LIVE
              </button>
              <button
                onClick={() => set({ prematchOnly: !filters.prematchOnly, liveOnly: false })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filters.prematchOnly
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="h-3 w-3" />
                Prematch
              </button>
            </div>
          </FilterSection>

          {/* Min Arb % */}
          <FilterSection title="Arb Percentage">
            <div className="pt-1 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range" min="-100" max="15" step="0.1" value={filters.minArb}
                  onChange={e => set({ minArb: Number(e.target.value) })}
                  className="flex-1 accent-blue-500 h-1"
                />
                <span className="text-white font-bold w-14 text-right tabular-nums text-xs">
                  {filters.minArb <= -10 ? 'Any' : `+${filters.minArb.toFixed(1)}%`}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[-100, 1, 2, 3, 5].map(v => (
                  <button
                    key={v}
                    onClick={() => set({ minArb: v })}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                      filters.minArb === v
                        ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                    }`}
                  >
                    {v === -100 ? 'Any' : `+${v}%`}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Sports */}
          <FilterSection title="Sports">
            <div className="pt-1 flex flex-wrap gap-1.5">
              {ALL_SPORTS.map(s => (
                <ToggleChip
                  key={s.name}
                  label={`${s.emoji} ${s.name}`}
                  active={filters.sports.length === 0 || filters.sports.includes(s.name)}
                  onClick={() => toggleList('sports', s.name)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Bookmakers */}
          <FilterSection title="Bookmakers (Back)">
            <div className="pt-1 flex flex-wrap gap-1.5">
              {availableBookmakers.map(b => (
                <ToggleChip
                  key={b}
                  label={b}
                  active={filters.bookmakers.length === 0 || filters.bookmakers.includes(b)}
                  onClick={() => toggleList('bookmakers', b)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Exchanges */}
          <FilterSection title="Exchanges (Lay)">
            <div className="pt-1 flex flex-wrap gap-1.5">
              {availableExchanges.map(e => (
                <ToggleChip
                  key={e}
                  label={e}
                  active={filters.exchanges.length === 0 || filters.exchanges.includes(e)}
                  onClick={() => toggleList('exchanges', e)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Markets */}
          <FilterSection title="Markets" defaultOpen={false}>
            <div className="pt-1 flex flex-wrap gap-1.5">
              {ALL_MARKETS.map(m => (
                <ToggleChip
                  key={m}
                  label={m}
                  active={filters.markets.length === 0 || filters.markets.includes(m)}
                  onClick={() => toggleList('markets', m)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Odds Range */}
          <FilterSection title="Back Odds Range" defaultOpen={false}>
            <div className="pt-1 space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Min Odds</span>
                  <span className="text-white">{filters.minOdds.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="1" max="20" step="0.1" value={filters.minOdds}
                  onChange={e => set({ minOdds: Number(e.target.value) })}
                  className="w-full accent-blue-500 h-1"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Max Odds</span>
                  <span className="text-white">{filters.maxOdds >= 50 ? '∞' : filters.maxOdds.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="2" max="50" step="0.5" value={filters.maxOdds}
                  onChange={e => set({ maxOdds: Number(e.target.value) })}
                  className="w-full accent-blue-500 h-1"
                />
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[hsl(222_30%_14%)] flex gap-2">
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-xs transition-colors"
          >
            Reset All
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Desktop Table Row ────────────────────────────────────────────────────────

function TableRow({ op, onDismiss }: { op: ArbOpportunity; onDismiss: (id: string) => void }) {
  const arbColor =
    op.arbPercentage >= 5 ? 'text-red-400' :
    op.arbPercentage >= 3 ? 'text-amber-400' :
    op.arbPercentage >= 1 ? 'text-green-400' : 'text-emerald-300';

  return (
    <tr className="border-b border-[hsl(222_30%_13%)] hover:bg-[hsl(222_47%_10%)] transition-colors group animate-in fade-in duration-300">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {op.isLive ? (
            <span className="arb-badge-live flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />LIVE
            </span>
          ) : (
            <span className="arb-badge-prematch">PRE</span>
          )}
          <span className="text-xs">{op.sportEmoji}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-gray-400 hidden lg:table-cell max-w-[130px]">
        <span className="truncate block" title={op.competition}>{op.competition}</span>
      </td>
      <td className="px-3 py-2.5 max-w-[180px]">
        <a href={op.bookmakerLink || op.exchangerLink || undefined} target="_blank" rel="noopener noreferrer" className="group/event">
          <p className="text-sm font-medium text-white truncate group-hover/event:text-blue-400 transition-colors">{op.event}</p>
          <p className="text-[10px] text-gray-500 truncate">{op.market}</p>
        </a>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-300 max-w-[100px]">
        <span className="truncate block">{op.selection}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`font-bold text-sm tabular-nums ${arbColor}`}>+{op.arbPercentage.toFixed(2)}%</span>
      </td>
      <td className="px-3 py-2.5">
        <a
          href={op.bookmakerLink || undefined}
          target="_blank" rel="noopener noreferrer"
          className="group/link block"
          onClick={e => { if (!op.bookmakerLink) e.preventDefault(); }}
        >
          <p className="text-sm font-bold text-white tabular-nums">{op.bookmakerOdds.toFixed(2)}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-gray-500 group-hover/link:text-blue-400 transition-colors">{op.bookmaker}</p>
            {op.bookmakerLink && <ExternalLink className="h-2.5 w-2.5 text-gray-600 group-hover/link:text-blue-400" />}
          </div>
        </a>
      </td>
      <td className="px-3 py-2.5">
        <a
          href={op.exchangerLink || undefined}
          target="_blank" rel="noopener noreferrer"
          className="group/link block"
          onClick={e => { if (!op.exchangerLink) e.preventDefault(); }}
        >
          <p className="text-sm font-bold text-white tabular-nums">{op.exchangerOdds.toFixed(2)}</p>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="group-hover/link:text-blue-400 transition-colors">{op.exchanger}</span>
            {op.exchangerLink && <ExternalLink className="h-2.5 w-2.5 text-gray-600 group-hover/link:text-blue-400" />}
            {(op.exchangerLiquidity ?? 0) > 0 && <span className="text-gray-600">(€{op.exchangerLiquidity})</span>}
          </div>
        </a>
      </td>
      <td className="px-3 py-2.5 w-8">
        <button
          onClick={() => onDismiss(op.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all"
          title="Dismiss"
        >✕</button>
      </td>
    </tr>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ opportunities }: { opportunities: ArbOpportunity[] }) {
  const live = opportunities.filter(o => o.isLive).length;
  const best = opportunities.length > 0 ? Math.max(...opportunities.map(o => o.arbPercentage)) : 0;
  const avgArb = opportunities.length > 0
    ? opportunities.reduce((s, o) => s + o.arbPercentage, 0) / opportunities.length
    : 0;

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b text-[11px] text-gray-500 overflow-x-auto"
      style={{ borderColor: 'hsl(222 30% 13%)', backgroundColor: 'hsl(222 47% 6%)' }}>
      <span className="flex items-center gap-1 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 font-medium">{live} Live</span>
      </span>
      <span className="shrink-0"><span className="text-white font-bold">{opportunities.length}</span> total</span>
      {best > 0 && (
        <span className="shrink-0 flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-400" />
          Best: <span className="text-amber-400 font-bold">+{best.toFixed(2)}%</span>
        </span>
      )}
      {avgArb > 0 && (
        <span className="shrink-0">Avg: <span className="text-white">{avgArb.toFixed(2)}%</span></span>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type SortKey = 'arbPercentage' | 'eventDate' | 'bookmakerOdds';

export default function OpportunityStream() {
  const { opportunities, status, isLoading, clearOpportunities } = useArbitrageData();
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('arbPercentage');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const availableBookmakers = useMemo(() => {
    const set = new Set(ALL_BOOKMAKERS);
    opportunities.forEach(o => o.bookmaker && set.add(o.bookmaker));
    return Array.from(set).sort();
  }, [opportunities]);

  const availableExchanges = useMemo(() => {
    const set = new Set(ALL_EXCHANGES);
    opportunities.forEach(o => o.exchanger && set.add(o.exchanger));
    return Array.from(set).sort();
  }, [opportunities]);

  // Arb alert settings — shared between sound hook and settings panel
  const [arbSettings, setArbSettings] = useState({
    defaultStake: 1000,
    minArbPercent: -100,
    soundThreshold: 2.0,
    soundOn: false,
  });

  const { triggerAlert } = useArbAlerts(arbSettings.soundThreshold);

  // Trigger sound when a new real opportunity arrives above threshold
  const prevCountRef = useRef(0);
  useMemo(() => {
    const newOps = opportunities.slice(0, opportunities.length - prevCountRef.current);
    if (arbSettings.soundOn) {
      newOps.forEach(op => triggerAlert({ id: op.id, arbPercentage: op.arbPercentage, isReal: op.isReal }));
    }
    prevCountRef.current = opportunities.length;
  }, [opportunities.length]); // eslint-disable-line

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  }, []);

  const filtered = useMemo(() => {
    const minArb = Math.max(filters.minArb, arbSettings.minArbPercent);
    return opportunities
      .filter(op => !dismissed.has(op.id))
      .filter(op => op.arbPercentage >= minArb)
      .filter(op => !filters.liveOnly || op.isLive)
      .filter(op => !filters.prematchOnly || !op.isLive)
      .filter(op => filters.sports.length === 0 || filters.sports.some(s => s.toLowerCase() === op.sport.toLowerCase()))
      .filter(op => filters.bookmakers.length === 0 || filters.bookmakers.includes(op.bookmaker))
      .filter(op => filters.exchanges.length === 0 || filters.exchanges.includes(op.exchanger))
      .filter(op => filters.markets.length === 0 || filters.markets.includes(op.market))
      .filter(op => op.bookmakerOdds >= filters.minOdds && op.bookmakerOdds <= filters.maxOdds)
      .sort((a, b) => {
        if (sortKey === 'arbPercentage') return b.arbPercentage - a.arbPercentage;
        if (sortKey === 'bookmakerOdds') return b.bookmakerOdds - a.bookmakerOdds;
        return 0;
      });
  }, [opportunities, dismissed, filters, sortKey, arbSettings.minArbPercent]);

  const activeFilterCount =
    filters.sports.length + filters.bookmakers.length + filters.exchanges.length +
    filters.markets.length + (filters.liveOnly ? 1 : 0) + (filters.prematchOnly ? 1 : 0) +
    (filters.minArb > 0 ? 1 : 0) + (filters.minOdds > 1 ? 1 : 0);

  return (
    <div className="flex flex-col h-full relative">
      <DashboardHeader status={status} onFilterClick={() => setFilterOpen(true)} />

      {/* Stats Bar */}
      <StatsBar opportunities={filtered} />

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ backgroundColor: 'hsl(222 47% 7%)', borderColor: 'hsl(222 30% 13%)' }}
      >
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
          {/* Filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className={`hidden sm:flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              activeFilterCount > 0
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-white/10 border-white/10'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort buttons */}
          {(['arbPercentage', 'eventDate', 'bookmakerOdds'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sortKey === k
                  ? 'bg-white/15 border-white/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10 border-white/10'
              }`}
            >
              {k === 'arbPercentage' && <><Percent className="h-3 w-3" />Highest %</>}
              {k === 'eventDate' && <><ArrowUpDown className="h-3 w-3" />Latest</>}
              {k === 'bookmakerOdds' && <><TrendingUp className="h-3 w-3" />Best Odds</>}
            </button>
          ))}

          <span className="text-xs text-gray-600 tabular-nums ml-1 shrink-0">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* View toggle */}
          <div className="hidden md:flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'cards' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}
              title="Card View"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}
              title="Table View"
            >
              <Table className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Settings gear */}
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`p-1.5 rounded-lg transition-colors border ${settingsOpen ? 'text-white bg-white/15 border-white/20' : 'text-gray-500 hover:text-white hover:bg-white/10 border-white/10'}`}
            title="Arb Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {/* Settings Panel dropdown */}
          {settingsOpen && (
            <ArbSettingsPanel
              settings={arbSettings}
              onChange={s => setArbSettings(s)}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {/* Clear */}
          {filtered.length > 0 && (
            <button
              onClick={() => { clearOpportunities(); setDismissed(new Set()); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        availableBookmakers={availableBookmakers}
        availableExchanges={availableExchanges}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-500">Connecting to live feed...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
            <TrendingUp className="h-12 w-12 text-gray-700" />
            <p className="text-gray-400 font-medium">
              {opportunities.length === 0 ? 'Waiting for opportunities...' : 'No results match your filters'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table view (desktop) */}
            {viewMode === 'table' && (
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[hsl(222_30%_13%)] text-[10px] text-gray-500 uppercase tracking-wider sticky top-0"
                      style={{ backgroundColor: 'hsl(222 47% 7%)' }}>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Competition</th>
                      <th className="px-3 py-2.5 font-medium">Event / Market</th>
                      <th className="px-3 py-2.5 font-medium">Selection</th>
                      <th className="px-3 py-2.5 font-medium">Arb %</th>
                      <th className="px-3 py-2.5 font-medium">Back (Bookmaker)</th>
                      <th className="px-3 py-2.5 font-medium">Lay (Exchange)</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(op => (
                      <TableRow key={op.id} op={op} onDismiss={handleDismiss} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cards view */}
            <div className={`p-3 grid gap-2.5 ${viewMode === 'table' ? 'md:hidden' : ''} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
              {filtered.map((op, i) => (
                <OpportunityCard
                  key={op.id}
                  opportunity={op}
                  onDismiss={handleDismiss}
                  isNew={i < 3}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
