import { useState, useEffect } from 'react';
import { ShieldCheck, Upload, CheckCircle, XCircle, RefreshCw, ChevronDown, Download } from 'lucide-react';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { photoUrl } from '../lib/ipfs.js';
import * as api from '../lib/chain-api.js';

function shortHash(h) {
  if (!h) return '';
  return h.slice(0, 8) + '...' + h.slice(-6);
}

// Highlight differing characters side-by-side
function HashComparison({ hash1, hash2, label1 = "Computed", label2 = "Recorded" }) {
  const h1 = (hash1 || '').toLowerCase();
  const h2 = (hash2 || '').toLowerCase();
  const maxLen = Math.max(h1.length, h2.length);

  return (
    <div className="space-y-2 font-mono text-xs overflow-x-auto p-3 bg-gray-50 rounded-md border border-gray-200">
      <div>
        <span className="text-gray-500 font-sans block mb-0.5">{label1}:</span>
        <div className="flex flex-wrap break-all">
          {Array.from({ length: maxLen }).map((_, i) => {
            const c1 = h1[i] || '';
            const c2 = h2[i] || '';
            const isDiff = c1 !== c2;
            return (
              <span
                key={i}
                className={isDiff ? 'bg-red-200 text-red-900 font-bold px-0.5 rounded' : 'text-gray-800'}
              >
                {c1 || '-'}
              </span>
            );
          })}
        </div>
      </div>
      <div>
        <span className="text-gray-500 font-sans block mb-0.5">{label2}:</span>
        <div className="flex flex-wrap break-all">
          {Array.from({ length: maxLen }).map((_, i) => {
            const c1 = h1[i] || '';
            const c2 = h2[i] || '';
            const isDiff = c1 !== c2;
            return (
              <span
                key={i}
                className={isDiff ? 'bg-red-200 text-red-900 font-bold px-0.5 rounded' : 'text-gray-800'}
              >
                {c2 || '-'}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const [loans, setLoans] = useState([]);
  const [equipmentMap, setEquipmentMap] = useState({});
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [activeStage, setActiveStage] = useState('checkout'); // 'checkout' | 'return'

  // Verification state
  const [computedHash, setComputedHash] = useState('');
  const [verdict, setVerdict] = useState(null); // 'match' | 'mismatch' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Advanced / manual section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCid, setManualCid] = useState('');
  const [manualHash, setManualHash] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [ls, eqs] = await Promise.all([api.listLoans(), api.listEquipment()]);
        if (cancelled) return;
        const eqMap = {};
        for (const eq of eqs) {
          eqMap[eq.id] = eq.name;
        }
        setEquipmentMap(eqMap);
        setLoans(ls);
        if (ls.length > 0) {
          const first = ls.find(l => l.checkoutHash) || ls[0];
          setSelectedLoanId(String(first.id));
          setSelectedLoan(first);
        }
      } catch (e) {
        if (!cancelled) setError('Failed loading loans: ' + e.message);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  const handleSelectLoan = (e) => {
    const id = e.target.value;
    setSelectedLoanId(id);
    setVerdict(null);
    setComputedHash('');
    setError('');
    const found = loans.find(l => String(l.id) === String(id));
    setSelectedLoan(found || null);
    if (found && !found.returnHash && activeStage === 'return') {
      setActiveStage('checkout');
    }
  };

  const currentTarget = () => {
    if (manualHash.trim()) {
      return {
        cid: manualCid.trim(),
        hash: manualHash.trim().toLowerCase(),
        stageName: 'Manual Entry'
      };
    }
    if (!selectedLoan) return null;
    if (activeStage === 'return' && selectedLoan.returnHash) {
      return {
        cid: selectedLoan.returnCid,
        hash: selectedLoan.returnHash.toLowerCase(),
        stageName: 'Return'
      };
    }
    return {
      cid: selectedLoan.checkoutCid,
      hash: (selectedLoan.checkoutHash || '').toLowerCase(),
      stageName: 'Checkout'
    };
  };

  const processFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setVerdict(null);
    try {
      // Direct raw SHA-256 computation in browser
      const h = await sha256Hex(file);
      setComputedHash(h.toLowerCase());
      const target = currentTarget();
      if (target?.hash) {
        const isMatch = h.toLowerCase() === target.hash;
        setVerdict(isMatch ? 'match' : 'mismatch');
      }
    } catch (err) {
      setError('Failed hashing file: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFetchFromIpfs = async () => {
    const target = currentTarget();
    if (!target?.cid) {
      setError('No CID available to fetch from IPFS.');
      return;
    }
    setBusy(true);
    setError('');
    setVerdict(null);
    try {
      const url = photoUrl(target.cid);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`IPFS gateway returned status ${res.status}`);
      const blob = await res.blob();
      const h = await sha256Hex(blob);
      setComputedHash(h.toLowerCase());
      if (target.hash) {
        const isMatch = h.toLowerCase() === target.hash;
        setVerdict(isMatch ? 'match' : 'mismatch');
      }
    } catch (err) {
      setError('Could not fetch or hash from IPFS: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const target = currentTarget();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="text-blue-600 shrink-0" size={24} />
          Tamper-evident verification
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify equipment photos against immutable cryptographic SHA-256 fingerprints recorded on Tezos Shadownet.
        </p>
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 p-3 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* (a) Loan picker dropdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Choose a loan record
          </label>
          <select
            value={selectedLoanId}
            onChange={handleSelectLoan}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {loans.length === 0 && <option value="">No loans on chain yet</option>}
            {loans.map((l) => {
              const itemName = equipmentMap[l.equipmentId] || `Equipment #${l.equipmentId}`;
              return (
                <option key={l.id} value={l.id}>
                  Loan #{l.id} — {itemName} ({l.status})
                </option>
              );
            })}
          </select>
        </div>

        {/* (b) On-chain records: Checkout and Return */}
        {selectedLoan && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Select record stage to compare:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Checkout Record Card */}
              <button
                type="button"
                onClick={() => { setActiveStage('checkout'); setVerdict(null); }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeStage === 'checkout'
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-900">Checkout Record</span>
                  {activeStage === 'checkout' && (
                    <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="text-gray-400">CID: </span>
                    <span className="font-mono text-gray-700 break-all">{selectedLoan.checkoutCid || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Hash: </span>
                    <span className="font-mono text-gray-700">{shortHash(selectedLoan.checkoutHash) || 'None'}</span>
                  </div>
                </div>
              </button>

              {/* Return Record Card */}
              <button
                type="button"
                disabled={!selectedLoan.returnHash}
                onClick={() => { setActiveStage('return'); setVerdict(null); }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  !selectedLoan.returnHash
                    ? 'opacity-50 cursor-not-allowed border-dashed border-gray-200'
                    : activeStage === 'return'
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-900">Return Record</span>
                  {selectedLoan.returnHash && activeStage === 'return' && (
                    <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  {selectedLoan.returnHash ? (
                    <>
                      <div>
                        <span className="text-gray-400">CID: </span>
                        <span className="font-mono text-gray-700 break-all">{selectedLoan.returnCid || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Hash: </span>
                        <span className="font-mono text-gray-700">{shortHash(selectedLoan.returnHash)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400 italic">No return photo recorded yet</div>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* (c) Drop Zone & Fetch from IPFS */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Verify a photo against selected {target?.stageName || 'on-chain'} record
          </label>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-6 text-center bg-gray-50/60 cursor-pointer transition-colors"
            onClick={() => document.getElementById('verify-file-input')?.click()}
          >
            <Upload size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-800">
              Drop photo file here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Computes SHA-256 locally in your browser and compares with the on-chain fingerprint
            </p>
            <input
              id="verify-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processFile(f);
              }}
            />
          </div>

          {target?.cid && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-500">Or verify the IPFS copy directly:</span>
              <button
                type="button"
                onClick={handleFetchFromIpfs}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 py-1 px-2.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {busy ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                Fetch from IPFS and re-hash
              </button>
            </div>
          )}
        </div>

        {/* Collapsed Advanced Section for manual CID/hash */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronDown size={14} className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            <span>Advanced (manual hash or CID override)</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-md border border-gray-200 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Manual IPFS CID</label>
                <input
                  type="text"
                  value={manualCid}
                  onChange={(e) => { setManualCid(e.target.value); setVerdict(null); }}
                  placeholder="e.g. bafkrei..."
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Manual Recorded SHA-256 Hash</label>
                <input
                  type="text"
                  value={manualHash}
                  onChange={(e) => { setManualHash(e.target.value); setVerdict(null); }}
                  placeholder="64 hex characters"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* (d) Big Verdict Banner */}
      {verdict && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-lg border-2 transition-all ${
              verdict === 'match'
                ? 'bg-green-50 border-green-500 text-green-900'
                : 'bg-red-50 border-red-500 text-red-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {verdict === 'match' ? (
                <CheckCircle size={26} className="text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={26} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-base font-bold tracking-tight">
                  {verdict === 'match'
                    ? 'MATCH: file is identical to the recorded photo'
                    : 'MISMATCH: file differs from what was recorded'}
                </h3>
                <p className="text-xs mt-1 text-gray-600">
                  {verdict === 'match'
                    ? 'The computed cryptographic digest matches the on-chain fingerprint character for character.'
                    : 'The computed cryptographic digest differs from the recorded record on Tezos Shadownet.'}
                </p>
              </div>
            </div>

            {/* Side-by-side with differing characters highlighted */}
            <div className="mt-4">
              <HashComparison
                hash1={computedHash}
                hash2={target?.hash || ''}
                label1="Computed photo hash (SHA-256)"
                label2={`On-chain ${target?.stageName || 'recorded'} hash (SHA-256)`}
              />
            </div>

            {/* Required honest line under the result */}
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200/70 italic">
              A match proves the file is unchanged since it was recorded. It does not prove the photo was truthful.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
