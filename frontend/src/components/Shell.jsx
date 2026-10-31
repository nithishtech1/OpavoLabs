import { useState } from 'react';
import { useWallet } from '../hooks/useWallet.js';
import { Wallet, LogOut, RotateCw, Menu, X, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import * as mockChain from '../lib/chain.mock.js';

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function Shell({ children }) {
  const { address, isAdmin, isMock, balanceMutez, loading, error, connect, disconnect, refresh } = useWallet();
  const loc = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mockMenuOpen, setMockMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const switchMockAccount = (name) => {
    mockChain.mockSetSender(name);
    refresh();
    setMockMenuOpen(false);
  };

  const nav = [
    { to: '/', label: 'Equipment' },
    { to: '/verify', label: 'Verify' },
    isAdmin ? { to: '/register', label: 'Register item' } : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Brand + Network + Nav */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="font-semibold text-gray-900 text-sm tracking-tight shrink-0">
              OpavoLabs
            </Link>
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded shrink-0">
              Shadownet
            </span>
            {isMock && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                Demo data
              </span>
            )}
            <nav className="hidden md:flex gap-1 ml-2">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                    loc.pathname === n.to ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side: Mock switcher / Refresh / Wallet */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mock Account Switcher */}
            {isMock && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMockMenuOpen(!mockMenuOpen)}
                  className="flex items-center gap-1 text-xs border border-gray-300 rounded px-2 py-1 text-gray-700 bg-white hover:bg-gray-50"
                  title="Switch mock role"
                >
                  <span>Role: {isAdmin ? 'Admin' : 'Student'}</span>
                  <ChevronDown size={12} />
                </button>
                {mockMenuOpen && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 shadow-md rounded-md py-1 z-50 w-36 text-xs">
                    <button
                      onClick={() => switchMockAccount('Admin')}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100 font-medium"
                    >
                      Admin
                    </button>
                    <button
                      onClick={() => switchMockAccount('StudentA')}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    >
                      Student A
                    </button>
                    <button
                      onClick={() => switchMockAccount('StudentB')}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    >
                      Student B
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Live Refresh Wallet button for real wallet switching */}
            {!isMock && address && (
              <button
                type="button"
                onClick={handleManualRefresh}
                className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100 transition-colors"
                title="Refresh wallet status from Temple"
              >
                <RotateCw size={14} className={refreshing ? 'animate-spin text-blue-600' : ''} />
              </button>
            )}

            {/* Wallet pill or Connect */}
            {address ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                    isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Student'}
                </span>
                <span className="text-xs sm:text-sm text-gray-700 font-mono" title={address}>
                  {shortAddr(address)}
                </span>
                {balanceMutez != null && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {(balanceMutez / 1e6).toFixed(2)} tez
                  </span>
                )}
                <button
                  onClick={disconnect}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  title="Disconnect wallet"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={loading}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
              >
                <Wallet size={14} />
                <span>{loading ? 'Connecting...' : 'Connect wallet'}</span>
              </button>
            )}

            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-gray-500 hover:text-gray-800 rounded"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-2 space-y-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block text-sm px-3 py-2 rounded-md font-medium transition-colors ${
                  loc.pathname === n.to ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 text-xs px-4 py-1.5 border-t border-red-100">{error}</div>}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 w-full flex-1 mb-8">{children}</main>

      {isMock && (
        <footer className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 text-center text-xs text-amber-800 py-1 font-medium whitespace-nowrap overflow-hidden text-ellipsis z-30 px-2">
          Demo data
        </footer>
      )}
    </div>
  );
}
