'use client';

/**
 * useArbAlerts hook
 *
 * Plays a sound when a new arbitrage opportunity arrives above the threshold.
 * Uses Web Audio API (no library needed, built into every browser).
 *
 * Usage:
 *   const { soundOn, toggleSound, setThreshold, threshold, triggerAlert } = useArbAlerts();
 */

import { useState, useRef, useCallback } from 'react';

export function useArbAlerts(defaultThreshold = 2.0) {
  const [soundOn, setSoundOn] = useState(false);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastAlertRef = useRef<Record<string, number>>({});

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Play a short two-tone chime (high-high = good arb found)
   * pitch: Hz, duration: seconds
   */
  const playChime = useCallback((pitch = 880, duration = 0.18) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.2, ctx.currentTime + duration / 2);
      osc.frequency.exponentialRampToValueAtTime(pitch, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [getAudioCtx]);

  /**
   * Play a double-chime for high arb (> threshold * 2)
   */
  const playHighArb = useCallback(() => {
    playChime(880, 0.15);
    setTimeout(() => playChime(1100, 0.2), 200);
  }, [playChime]);

  /**
   * Call this when a new opportunity arrives.
   * Returns true if alert was played.
   */
  const triggerAlert = useCallback((opportunity: { id: string; arbPercentage?: number; isReal?: boolean }) => {
    if (!soundOn) return false;
    const arb = opportunity.arbPercentage || 0;
    if (arb < threshold) return false;

    // Anti-spam: same id max once per 30s
    const now = Date.now();
    const last = lastAlertRef.current[opportunity.id] || 0;
    if (now - last < 30000) return false;
    lastAlertRef.current[opportunity.id] = now;

    if (arb >= threshold * 2) {
      playHighArb(); // double chime for exceptional arb
    } else {
      playChime(880, 0.2);
    }
    return true;
  }, [soundOn, threshold, playChime, playHighArb]);

  const toggleSound = useCallback(() => setSoundOn(v => !v), []);

  return { soundOn, toggleSound, threshold, setThreshold, triggerAlert };
}
