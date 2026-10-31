import { useWallet } from '../hooks/useWallet.js';
import { Wallet, LogOut, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { IS_MOCK } from '../lib/chain-api.js';

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function Shell({ children }) {
  const { address, isAdmin, balanceMutez, loading, error, connect, disconnect } = useWallet();
  const loc = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nav = [
    { to: '/', label: 'Equipment' },
    { to: '/verify', label: 'Verify' },
    address && isAdmin ? { to: '/register', label: 'Register item' } : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold text-gray-900 text-sm tracking-tight shrink-0">
              OpavoLabs
            </Link>
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded shrink-0">
              Shadownet
            </span>
            {IS_MOCK && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                Demo data
              </span>
            )}
            <nav className="hidden md:flex gap-1 ml-2">
              {nav.map(n => (
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

          <div className="flex items-center gap-2">
            {address ? (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                    isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Student'}
                </span>
                <span className="text-xs sm:text-sm text-gray-700 font-mono">
                  {shortAddr(address)}
                </span>
                {balanceMutez != null && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {(balanceMutez / 1e6).toFixed(2)} tez
                  </span>
                )}
                <button
                  onClick={disconnect}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md"
                  title="Disconnect"
                >
                  <LogOut size={16} />
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

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-gray-500 hover:text-gray-800 rounded-md"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-2 space-y-1">
            {nav.map(n => (
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

      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1 mb-8">{children}</main>

      {IS_MOCK && (
        <footer className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 text-center text-xs text-amber-800 py-1 font-medium whitespace-nowrap overflow-hidden text-ellipsis z-30 px-2">
          Demo data
        </footer>
      )}
    </div>
  );
}
