import { useState } from 'react';
import { connect, disconnect, getBalanceMutez } from '../lib/tezos.js';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { uploadToIpfs, photoUrl } from '../lib/ipfs.js';

export default function DevReal() {
  // Wallet state
  const [walletAddress, setWalletAddress] = useState(null);
  const [balanceMutez, setBalanceMutez] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);

  // Photo & IPFS state
  const [selectedFile, setSelectedFile] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [originalHash, setOriginalHash] = useState(null);
  const [uploadedCid, setUploadedCid] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoStep, setPhotoStep] = useState('');
  const [photoError, setPhotoError] = useState(null);

  // Verify / Re-hash state
  const [rehashResult, setRehashResult] = useState(null);
  const [rehashLoading, setRehashLoading] = useState(false);
  const [rehashError, setRehashError] = useState(null);

  // 1. Connect Temple / Beacon wallet
  async function handleConnectWallet() {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const pkh = await connect();
      setWalletAddress(pkh);
      const bal = await getBalanceMutez(pkh);
      setBalanceMutez(bal);
    } catch (err) {
      console.error(err);
      const msg = err?.message || String(err);
      if (msg.includes('aborted') || msg.includes('cancelled') || msg.includes('User aborted') || msg.includes('declined')) {
        setWalletError('Wallet connection was cancelled or the popup was closed.');
      } else {
        setWalletError(`Failed to connect wallet: ${msg}`);
      }
    } finally {
      setWalletLoading(false);
    }
  }

  // Disconnect wallet
  async function handleDisconnectWallet() {
    try {
      await disconnect();
      setWalletAddress(null);
      setBalanceMutez(null);
    } catch (err) {
      console.error(err);
    }
  }

  // 2. Select photo
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCompressedBlob(null);
      setOriginalHash(null);
      setUploadedCid(null);
      setPhotoError(null);
      setRehashResult(null);
    }
  }

  // 3. Compress photo and compute local SHA-256
  async function handleCompressAndHash() {
    if (!selectedFile) return;
    setPhotoLoading(true);
    setPhotoStep('Compressing image...');
    setPhotoError(null);
    try {
      const blob = await compressImage(selectedFile);
      setCompressedBlob(blob);
      setPhotoStep('Computing SHA-256 hash...');
      const hash = await sha256Hex(blob);
      setOriginalHash(hash);
      setPhotoStep('Ready for upload.');
    } catch (err) {
      console.error(err);
      setPhotoError(`Compression or hashing failed: ${err.message || err}`);
    } finally {
      setPhotoLoading(false);
    }
  }

  // 4. Upload compressed blob to IPFS
  async function handleUploadToIpfs() {
    if (!compressedBlob) return;
    setPhotoLoading(true);
    setPhotoStep('Requesting signed URL and uploading to IPFS...');
    setPhotoError(null);
    try {
      const cid = await uploadToIpfs(compressedBlob);
      setUploadedCid(cid);
      setPhotoStep('Upload complete!');
    } catch (err) {
      console.error(err);
      setPhotoError(`IPFS upload failed: ${err.message || err}`);
    } finally {
      setPhotoLoading(false);
    }
  }

  // 5. Download from IPFS and re-hash to verify integrity
  async function handleDownloadAndRehash() {
    if (!uploadedCid || !originalHash) return;
    setRehashLoading(true);
    setRehashError(null);
    setRehashResult(null);
    try {
      const url = photoUrl(uploadedCid);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to download from IPFS gateway (${res.status} ${res.statusText})`);
      }
      const downloadedBlob = await res.blob();
      const downloadedHash = await sha256Hex(downloadedBlob);

      const matches = downloadedHash.toLowerCase() === originalHash.toLowerCase();
      setRehashResult({
        downloadedHash,
        matches,
      });
    } catch (err) {
      console.error(err);
      setRehashError(`Re-hash failed: ${err.message || err}`);
    } finally {
      setRehashLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">/dev-real integration test</h1>
        <p className="text-sm text-gray-600 mt-1">
          Tests real Temple wallet connection, local compression, SHA-256 hashing, signed Pinata IPFS uploads, and integrity verification. (No smart contract required).
        </p>
      </div>

      {/* SECTION 1: WALLET */}
      <section className="p-5 border rounded-lg bg-white shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">1. Temple Wallet (Shadownet)</h2>

        {walletError && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {walletError}
          </div>
        )}

        {walletAddress ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium text-gray-700">Address:</span>{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{walletAddress}</code>
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-700">Balance:</span>{' '}
              <span className="font-semibold text-gray-900">
                {balanceMutez != null ? (balanceMutez / 1_000_000).toFixed(6) : '...'} TEZ
              </span>{' '}
              <span className="text-xs text-gray-500">({balanceMutez?.toLocaleString() ?? 0} mutez)</span>
            </p>
            <button
              onClick={handleDisconnectWallet}
              className="mt-2 px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 rounded font-medium transition"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectWallet}
            disabled={walletLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-sm transition"
          >
            {walletLoading ? 'Connecting wallet (check popup)...' : 'Connect Temple wallet'}
          </button>
        )}
      </section>

      {/* SECTION 2: PHOTO COMPRESS, HASH & IPFS UPLOAD */}
      <section className="p-5 border rounded-lg bg-white shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">2. Photo Pipeline (Compress &rarr; Hash &rarr; IPFS)</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select a photo:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleCompressAndHash}
              disabled={!selectedFile || photoLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium text-sm transition"
            >
              Compress & Hash
            </button>

            <button
              onClick={handleUploadToIpfs}
              disabled={!compressedBlob || photoLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-medium text-sm transition"
            >
              Upload to IPFS
            </button>
          </div>

          {photoLoading && (
            <p className="text-sm text-blue-600 animate-pulse font-medium">{photoStep}</p>
          )}

          {photoError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
              {photoError}
            </div>
          )}

          {originalHash && (
            <div className="p-3 bg-gray-50 rounded border space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Local SHA-256 Hash:</span>
              <p className="font-mono text-xs break-all text-gray-900">{originalHash}</p>
            </div>
          )}

          {uploadedCid && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded space-y-3">
              <div>
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">IPFS CID:</span>
                <p className="font-mono text-xs break-all text-emerald-950 font-semibold">{uploadedCid}</p>
              </div>

              <div>
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block mb-1">
                  Loaded from Pinata Gateway:
                </span>
                <img
                  src={photoUrl(uploadedCid)}
                  alt="Uploaded preview"
                  className="max-h-64 rounded border shadow-sm object-contain bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: DOWNLOAD AND RE-HASH VERIFICATION */}
      <section className="p-5 border rounded-lg bg-white shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">3. Integrity Verification (Download & Re-hash)</h2>

        <p className="text-xs text-gray-600">
          Fetches the file directly from the IPFS gateway, hashes the downloaded bytes locally, and verifies that it is identical to the hash computed before upload.
        </p>

        <button
          onClick={handleDownloadAndRehash}
          disabled={!uploadedCid || rehashLoading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded font-medium text-sm transition"
        >
          {rehashLoading ? 'Downloading & re-hashing...' : 'Download and re-hash'}
        </button>

        {rehashError && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {rehashError}
          </div>
        )}

        {rehashResult && (
          <div className={`p-4 rounded border ${rehashResult.matches ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${rehashResult.matches ? 'text-green-800' : 'text-red-800'}`}>
                {rehashResult.matches ? 'PASS: Hashes match perfectly!' : 'FAIL: Hashes do not match!'}
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs">
              <p><span className="font-bold text-gray-700">Original hash:</span> {originalHash}</p>
              <p><span className="font-bold text-gray-700">Fetched hash: </span> {rehashResult.downloadedHash}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
