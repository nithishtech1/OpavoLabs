// Tamper-Detection Engine. Pure logic; fetch is injectable so it is unit-testable.
import { sha256Hex } from './hash.js';

async function defaultFetchBlob(cid) {
  const { photoUrl, photoFallbackUrl, withTimeout } = await import('./ipfs.js');
  for (const url of [photoUrl(cid), photoFallbackUrl(cid)]) {
    try {
      const res = await withTimeout(fetch(url), 30000, 'gateway timeout');
      if (res.ok) return await res.blob();
    } catch { /* try next gateway */ }
  }
  throw new Error('Could not fetch photo from IPFS');
}

export async function flipOneByte(blob) {
  const u8 = new Uint8Array(await blob.arrayBuffer());
  u8[Math.floor(u8.length / 2)] ^= 0xff;
  return new Blob([u8], { type: blob.type });
}

// cid + onchainHash come from the loan record. file = optional dropped local file.
export async function verifyPhoto({ cid, onchainHash, file = null, simulateTamper = false, fetchBlob = defaultFetchBlob }) {
  let blob = file ?? (await fetchBlob(cid));
  if (simulateTamper) blob = await flipOneByte(blob);
  const computed = (await sha256Hex(blob)).toLowerCase();
  const onchain = String(onchainHash).replace(/^0x/, '').toLowerCase();
  return { match: computed === onchain, computed, onchain, simulated: simulateTamper };
}
