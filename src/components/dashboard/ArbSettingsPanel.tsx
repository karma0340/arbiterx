'use client';

import { useState } from 'react';
import { Settings, X, Bell, BellOff, Volume2, VolumeX, DollarSign } from 'lucide-react';

interface ArbSettings {
  defaultStake: number;
  minArbPercent: number;
  soundThreshold: number;
  soundOn: boolean;
}

interface ArbSettingsPanelProps {
  settings: ArbSettings;
  onChange: (settings: ArbSettings) => void;
  onClose: () => void;
}

export function ArbSettingsPanel({ settings, onChange, onClose }: ArbSettingsPanelProps) {
  const [local, setLocal] = useState<ArbSettings>(settings);

  const update = (patch: Partial<ArbSettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-[hsl(222_47%_8%)] border border-[hsl(222_30%_20%)] rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(222_30%_16%)]">
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold text-white">Arb Settings</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-500 hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Default Stake */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase tracking-wide mb-2">
            <DollarSign className="h-3 w-3" />
            Default Stake Amount
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">€</span>
            <input
              type="number"
              value={local.defaultStake}
              onChange={e => update({ defaultStake: Math.max(1, parseInt(e.target.value) || 100) })}
              className="flex-1 bg-[hsl(222_47%_6%)] border border-[hsl(222_30%_18%)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50"
              min={1}
              step={100}
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Used as default in the stake calculator on each card</p>
        </div>

        {/* Min Arb Filter */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase tracking-wide mb-2">
            <Settings className="h-3 w-3" />
            Minimum Arb % to Show
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={-100}
              max={10}
              step={0.5}
              value={local.minArbPercent}
              onChange={e => update({ minArbPercent: parseFloat(e.target.value) })}
              className="flex-1 accent-primary"
            />
            <span className="text-sm font-bold text-white tabular-nums w-12 text-right">
              {local.minArbPercent.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Cards below this threshold are hidden</p>
        </div>

        {/* Sound Alert Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase tracking-wide">
              {local.soundOn ? <Volume2 className="h-3 w-3 text-green-400" /> : <VolumeX className="h-3 w-3" />}
              Sound Alerts
            </label>
            <button
              onClick={() => update({ soundOn: !local.soundOn })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                local.soundOn
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'bg-gray-600/20 text-gray-500 border-gray-600/30'
              }`}
            >
              {local.soundOn ? <><Bell className="h-2.5 w-2.5" /> ON</> : <><BellOff className="h-2.5 w-2.5" /> OFF</>}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={local.soundThreshold}
              onChange={e => update({ soundThreshold: parseFloat(e.target.value) })}
              className="flex-1 accent-primary"
              disabled={!local.soundOn}
            />
            <span className={`text-sm font-bold tabular-nums w-12 text-right ${local.soundOn ? 'text-white' : 'text-gray-600'}`}>
              {local.soundThreshold.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {local.soundOn ? `Chime plays when arb > ${local.soundThreshold}%` : 'Enable to get audio alerts'}
          </p>
        </div>

        {/* Telegram tip */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-blue-400 font-medium mb-0.5">📱 Telegram Alerts</p>
          <p className="text-[10px] text-gray-500">
            Set <code className="text-blue-300">TELEGRAM_BOT_TOKEN</code> &amp;&amp; <code className="text-blue-300">TELEGRAM_CHAT_ID</code> in <code className="text-blue-300">backend/.env</code> to get phone notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
