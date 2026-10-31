import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../lib/chain-api.js';

export function checkIsAdmin(connectedAddress, adminAddress) {
  if (!connectedAddress || !adminAddress) return false;
  return String(connectedAddress).trim().toLowerCase() === String(adminAddress).trim().toLowerCase();
}

const WalletCtx = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [balanceMutez, setBalanceMutez] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isMock = api.IS_MOCK;
  const isAdmin = checkIsAdmin(address, admin);

  const refresh = useCallback(async () => {
    try {
      const [addr, adm] = await Promise.all([
        api.getAddress().catch(() => null),
        api.getAdmin().catch(() => null)
      ]);
      setAddress(addr);
      setAdmin(adm);
      if (addr) {
        const bal = await api.getBalanceMutez(addr).catch(() => null);
        setBalanceMutez(bal);
      } else {
        setBalanceMutez(null);
      }
    } catch (e) {
      console.error('Wallet refresh error:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodic polling + window focus detection for painless wallet switching in Temple
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pkh = await api.connectWallet();
      setAddress(pkh);
      const [bal, adm] = await Promise.all([
        api.getBalanceMutez(pkh).catch(() => null),
        api.getAdmin().catch(() => null)
      ]);
      setBalanceMutez(bal);
      setAdmin(adm);
      return pkh;
    } catch (e) {
      const msg = e?.message || String(e);
      if (/abort|cancel|declin|denied|reject/i.test(msg)) {
        setError('Connection cancelled in wallet.');
      } else {
        setError(msg);
      }
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await api.disconnectWallet();
    } catch {}
    setAddress(null);
    setBalanceMutez(null);
  }, []);

  return (
    <WalletCtx.Provider
      value={{
        address,
        admin,
        isAdmin,
        balanceMutez,
        isMock,
        loading,
        error,
        connect,
        disconnect,
        refresh,
        checkIsAdmin
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
