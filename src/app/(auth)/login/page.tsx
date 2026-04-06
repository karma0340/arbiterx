'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Signal, Loader2, WifiOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; msg: string; type: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('https://login.arbitragex.pro/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });

      if (!res.ok) {
        let title = 'Login Failed';
        let msg = 'An unexpected error occurred.';
        try {
          const data = await res.json();
          msg = data.message || data.error || msg;
        } catch { /* ignore */ }

        if (res.status === 401) { title = 'Invalid Credentials'; msg = 'Incorrect email or password.'; }
        else if (res.status === 403) { title = 'Access Forbidden'; msg = 'Your account may be suspended.'; }
        else if (res.status === 429) { title = 'Too Many Attempts'; msg = 'Please wait before trying again.'; }
        else if (res.status >= 500) { title = 'Server Error'; msg = 'The server is temporarily unavailable.'; }

        setError({ title, msg, type: res.status === 401 ? 'auth' : 'general' });
        return;
      }

      const data = await res.json();
      if (!data.token) {
        setError({ title: 'Auth Error', msg: 'No token received from server.', type: 'server' });
        return;
      }

      localStorage.setItem('authToken', data.token);
      if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));
      router.push('/dashboard');

    } catch (err) {
      const isNetwork = err instanceof TypeError && (err as TypeError).message.includes('fetch');
      setError({
        title: isNetwork ? 'Network Error' : 'Connection Error',
        msg: isNetwork ? 'Cannot reach the login server. Check your connection.' : 'An unexpected error occurred.',
        type: isNetwork ? 'network' : 'general',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, hsl(212 100% 20% / 0.3) 0%, hsl(222 47% 6%) 60%)',
      }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(hsl(210 40% 96%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 96%) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <Signal className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">ArbitrageX</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to access live arbitrage opportunities</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 border"
          style={{ backgroundColor: 'hsl(222 47% 9%)', borderColor: 'hsl(222 30% 16%)' }}
        >
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2.5">
              {error.type === 'network'
                ? <WifiOff className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              }
              <div>
                <p className="text-sm font-semibold text-red-400">{error.title}</p>
                <p className="text-xs text-red-400/80 mt-0.5">{error.msg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 border outline-none transition-colors focus:border-primary/60"
                style={{ backgroundColor: 'hsl(222 47% 6%)', borderColor: error?.type === 'auth' ? 'hsl(0 85% 60% / 0.5)' : 'hsl(222 30% 16%)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 border outline-none transition-colors focus:border-primary/60"
                style={{ backgroundColor: 'hsl(222 47% 6%)', borderColor: error?.type === 'auth' ? 'hsl(0 85% 60% / 0.5)' : 'hsl(222 30% 16%)' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'hsl(212 100% 55%)' }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Real-time arbitrage opportunities across sports markets
        </p>
      </div>
    </div>
  );
}
