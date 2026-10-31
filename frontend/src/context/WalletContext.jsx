import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as chain from '../lib/chain.js';

const WalletCtx = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const a = await chain.getAddress();
      setAddress(a || null);
      const adm = await chain.getAdmin();
      setAdmin(adm);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const a = await chain.connectWallet();
      setAddress(a);
      const adm = await chain.getAdmin();
      setAdmin(adm);
      return a;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await chain.disconnectWallet();
    setAddress(null);
  }, []);

  const isAdmin = address && admin && address === admin;
  const isMock = chain.IS_MOCK;

  return (
    <WalletCtx.Provider value={{ address, admin, isAdmin, isMock, connecting, connect, disconnect, refresh }}>
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
}
