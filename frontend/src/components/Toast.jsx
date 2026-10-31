import { Toaster, toast as _toast } from 'react-hot-toast';

export { Toaster };

export function toast(msg, type = 'default') {
  if (type === 'success') return _toast.success(msg);
  if (type === 'error') return _toast.error(msg);
  return _toast(msg);
}

export function toastOp(label) {
  const id = _toast.loading(`${label}: signing in wallet...`);
  return {
    signing: () => _toast.loading(`${label}: waiting for wallet signature...`, { id }),
    confirming: (hash) => _toast.loading(`${label}: confirming on Tezos Shadownet...`, { id }),
    slow: (hash) => _toast(`${label}: Still confirming, check the explorer`, { id, icon: '⏳', duration: 15000 }),
    done: (msg) => _toast.success(msg || `${label}: confirmed on-chain!`, { id }),
    error: (msg) => _toast.error(msg || `${label}: transaction failed`, { id }),
  };
}
