// Upload via a short-lived signed URL; the Pinata JWT never reaches the browser.
// If a pinata SDK method is missing, check your installed version vs docs.pinata.cloud.
import { PinataSDK } from 'pinata';

const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY;
// Created lazily so a missing/placeholder env var can never crash the page at load time.
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
    if (!res.ok) throw new Error('upload-url failed: ' + res.status);
    const { url } = await res.json();
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const upload = await getPinata().upload.public.file(file).url(url);
    return upload.cid;
  };
  return withTimeout(run(), 30000, 'IPFS upload timeout');
}

export const photoUrl = (cid) => `https://${GATEWAY}/ipfs/${cid}`;
export const photoFallbackUrl = (cid) => `https://ipfs.io/ipfs/${cid}`;
