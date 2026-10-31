import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/chain-api.js';

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [balanceMutez, setBalanceMutez] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = address && admin && address.toLowerCase() === admin.toLowerCase();

  const connect = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const pkh = await api.connectWallet();
      setAddress(pkh);
      const [bal, adminAddr] = await Promise.all([
        api.getBalanceMutez(pkh).catch(() => null),
        api.getAdmin().catch(() => null),
      ]);
      setBalanceMutez(bal);
      setAdmin(adminAddr);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('aborted') || msg.includes('cancel') || msg.includes('declined')) {
        setError('Connection cancelled.');
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  }, []);

  const disconnect = useCallback(async () => {
    try { await api.disconnectWallet(); } catch {}
    setAddress(null); setBalanceMutez(null);
  }, []);

  // Load admin on mount
  useEffect(() => {
    api.getAdmin().then(setAdmin).catch(() => {});
  }, []);

  return { address, admin, balanceMutez, isAdmin, loading, error, connect, disconnect };
}
