import { useWallet } from '../hooks/useWallet.js';
import { Wallet, LogOut, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { IS_MOCK } from '../lib/chain-api.js';

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function Shell({ children }) {
  const { address, isAdmin, balanceMutez, loading, error, connect, disconnect } = useWallet();
  const loc = useLocation();

  const nav = [
    { to: '/', label: 'Equipment' },
    { to: '/verify', label: 'Verify' },
    address && isAdmin ? { to: '/register', label: 'Register item' } : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-semibold text-gray-900 text-sm tracking-tight">OpavoLabs</span>
          <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded">Shadownet</span>
          {IS_MOCK && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">Mock mode</span>
          )}
          <nav className="hidden sm:flex gap-1 ml-2">
            {nav.map(n => (
              <Link key={n.to} to={n.to}
                className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${loc.pathname === n.to ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {address ? (
              <>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {isAdmin ? 'Admin' : 'Student'}
                </span>
                <span className="text-sm text-gray-700 font-mono hidden sm:inline">{shortAddr(address)}</span>
                {balanceMutez != null && (
                  <span className="text-xs text-gray-500 hidden sm:inline">{(balanceMutez / 1e6).toFixed(2)} tez</span>
                )}
                <button onClick={disconnect} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md" title="Disconnect">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button onClick={connect} disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
                <Wallet size={14} />
                {loading ? 'Connecting...' : 'Connect wallet'}
              </button>
            )}
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-xs px-4 py-1.5 border-t border-red-100">{error}</div>}
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      {IS_MOCK && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 text-center text-xs text-amber-700 py-1.5 font-medium">
          Mock mode — no real transactions. Set VITE_MOCK=0 for live chain.
        </div>
      )}
    </div>
  );
}
