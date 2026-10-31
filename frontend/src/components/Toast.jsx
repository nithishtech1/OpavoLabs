import { Toaster, toast as _toast } from 'react-hot-toast';

export { Toaster };

export function toast(msg, type = 'default') {
  if (type === 'success') return _toast.success(msg);
  if (type === 'error') return _toast.error(msg);
  return _toast(msg);
}

export function toastOp(label) {
  const id = _toast.loading(`${label}: signing...`);
  return {
    signing: () => _toast.loading(`${label}: signing...`, { id }),
    confirming: () => _toast.loading(`${label}: confirming...`, { id }),
    done: (msg) => _toast.success(msg || `${label}: done`, { id }),
    error: (msg) => _toast.error(msg || `${label}: failed`, { id }),
  };
}
