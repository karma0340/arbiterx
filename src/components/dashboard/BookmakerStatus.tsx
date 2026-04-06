'use client';

import { useEffect, useState } from 'react';

interface ScraperInfo {
  lastRun: string | null;
  lastCount: number;
  status: 'ok' | 'no_data' | 'idle' | 'running';
}

interface ScraperState {
  [key: string]: ScraperInfo;
}

const BOOKMAKER_LABELS: Record<string, { label: string; url: string }> = {
  baywin:  { label: 'Baywin',  url: 'https://355baywin.com' },
  golbet:  { label: 'Golbet',  url: 'https://golbet724.com' },
  papa:    { label: 'Papa',    url: 'https://papa.live' },
  kolay40: { label: 'Kolay40', url: 'https://kolay40.com' },
};

export function BookmakerStatus() {
  const [status, setStatus] = useState<ScraperState>({});
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/scraper/status');
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.sources?.reduce((acc: ScraperState, s: any) => {
          acc[s.key] = s;
          return acc;
        }, {}) || data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const bookmakers = Object.keys(BOOKMAKER_LABELS);

  return (
    <div className="flex items-center gap-3">
      {bookmakers.map(key => {
        const info = status[key];
        const { label } = BOOKMAKER_LABELS[key];
        const dot = !info
          ? 'bg-gray-600'
          : info.status === 'ok'
          ? 'bg-green-400 animate-pulse'
          : info.status === 'running'
          ? 'bg-amber-400 animate-pulse'
          : 'bg-red-500';

        const tooltip = !info
          ? 'No data yet'
          : info.status === 'ok'
          ? `${info.lastCount} events loaded`
          : info.status === 'running'
          ? 'Scraping...'
          : 'No data';

        return (
          <div
            key={key}
            className="flex items-center gap-1.5 text-[11px] text-gray-400"
            title={`${label}: ${tooltip}`}
          >
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span>{label}</span>
            {info?.lastCount ? (
              <span className="text-gray-600">({info.lastCount})</span>
            ) : null}
          </div>
        );
      })}
      {lastUpdated && (
        <span className="text-[10px] text-gray-600 ml-1">↻{lastUpdated}</span>
      )}
    </div>
  );
}
