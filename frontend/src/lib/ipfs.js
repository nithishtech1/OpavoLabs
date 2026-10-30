// Upload via a short-lived signed URL; the Pinata JWT never reaches the browser.
import { PinataSDK } from 'pinata';

const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY;

let _pinata;
const getPinata = () => (_pinata ??= new PinataSDK({ pinataJwt: '', pinataGateway: GATEWAY }));

export function withTimeout(promise, ms = 30000, label = 'timeout') {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label)), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

export async function uploadToIpfs(blob) {
  const run = async () => {
    const res = await fetch('/api/upload-url');
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`upload-url failed (${res.status}): ${errBody.message || errBody.error || res.statusText}`);
    }
    const { url } = await res.json();
    if (!url) throw new Error('Signed upload URL was empty');

    // Create a File from the exact blob provided
    const mime = blob.type || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    const file = new File([blob], `photo.${ext}`, { type: mime });

    const upload = await getPinata().upload.public.file(file).url(url);
    if (!upload?.cid) throw new Error('Upload succeeded but no CID was returned');
    return upload.cid;
  };
  return withTimeout(run(), 30000, 'IPFS upload timeout (30s)');
}

export const photoUrl = (cid) => {
  if (!cid) return '';
  return `https://${GATEWAY}/ipfs/${cid}`;
};

export const photoFallbackUrl = (cid) => {
  if (!cid) return '';
  return `https://ipfs.io/ipfs/${cid}`;
};
