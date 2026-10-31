// Upload via a short-lived signed URL; the Pinata JWT never reaches the browser.
import { PinataSDK } from 'pinata';

const GATEWAY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PINATA_GATEWAY) || 'lime-careful-thrush-231.mypinata.cloud';

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
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`upload-url failed (${res.status}): ${errBody.message || errBody.error || res.statusText}`);
      }
      const rawText = await res.text().catch(() => '');
      throw new Error(`upload-url failed (${res.status}): ${rawText.slice(0, 100) || res.statusText}`);
    }

    if (!contentType.includes('application/json')) {
      const rawText = await res.text().catch(() => '');
      throw new Error(`upload-url returned non-JSON response (${contentType || 'empty'}). Check that the local API backend is handling /api/upload-url: ${rawText.slice(0, 80)}`);
    }

    const data = await res.json();
    const url = data?.url;
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

// Fetch with fallback (Pinata first, ipfs.io second) and 15s timeout
export async function fetchPhotoBlob(cid) {
  if (!cid) throw new Error('No IPFS CID provided');
  const urls = [photoUrl(cid), photoFallbackUrl(cid)].filter(Boolean);
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await withTimeout(fetch(url), 15000, 'IPFS gateway timeout (15s)');
      if (res.ok) {
        return await res.blob();
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('Could not download photo from IPFS gateway. Please check your network connection.');
}
