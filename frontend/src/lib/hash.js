// "Local Crypto Engine": SHA-256 of a Blob/File. 64 lowercase hex chars, no 0x.
// Needs https:// or localhost (crypto.subtle). Hash the EXACT bytes you upload.
export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
