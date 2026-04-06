'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Volume2, VolumeX, Maximize2, LogOut, HelpCircle, Signal, SlidersHorizontal, RefreshCw, History } from 'lucide-react';
import { useState } from 'react';
import { BookmakerStatus } from '@/components/dashboard/BookmakerStatus';

interface DashboardHeaderProps {
  onFilterClick?: () => void;
  status?: 'connected' | 'disconnected' | 'connecting' | 'demo';
}

export function DashboardHeader({ onFilterClick, status = 'connected' }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [soundOn, setSoundOn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    router.push('/login');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('http://localhost:4000/api/scraper/reload', { method: 'POST' });
    } catch {}
    setTimeout(() => setRefreshing(false), 2000);
  };

  const statusConfig = {
    connected:   { color: 'text-green-400', dot: 'bg-green-400', label: 'Connected' },
    demo:        { color: 'text-blue-400',  dot: 'bg-blue-400',  label: 'Demo Mode' },
    connecting:  { color: 'text-amber-400', dot: 'bg-amber-400', label: 'Connecting...' },
    disconnected:{ color: 'text-red-400',   dot: 'bg-red-400',   label: 'Disconnected' },
  };

  const s = statusConfig[status] || statusConfig.connected;

  return (
    <header
      style={{ backgroundColor: 'hsl(222 47% 7%)', borderBottom: '1px solid hsl(222 30% 14%)' }}
      className="sticky top-0 z-50 flex flex-col"
    >
      {/* Main header row */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        {/* Left: Logo + Status + Nav */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Signal className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-tight hidden sm:block">ArbitrageX</span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1 border border-white/10">
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'connected' || status === 'demo' ? 'animate-pulse' : ''}`} />
            <span className={`text-[11px] font-medium ${s.color}`}>{s.label}</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <a
              href="/dashboard"
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${pathname === '/dashboard' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Live
            </a>
            <a
              href="/dashboard/history"
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${pathname === '/dashboard/history' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <History className="h-3 w-3" />
              History
            </a>
          </nav>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {onFilterClick && (
            <button onClick={onFilterClick} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Filters">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-colors ${refreshing ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            title="Refresh all scrapers now"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => setSoundOn(p => !p)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title={soundOn ? 'Mute' : 'Sound'}>
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex" title="Help">
            <HelpCircle className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button onClick={handleLogout} className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bookmaker live status bar */}
      <div className="px-3 pb-2 flex items-center gap-2 border-t border-white/[0.04]">
        <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-1">Sources:</span>
        <BookmakerStatus />
      </div>
    </header>
  );
}
