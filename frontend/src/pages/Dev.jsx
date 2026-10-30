// Hidden /dev page: a control panel to test every module AND run a full real checkout/return
// before the real pages exist. Open at http://localhost:5173/#/dev
import { useState } from 'react';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { uploadToIpfs, photoUrl } from '../lib/ipfs.js';
import * as chain from '../lib/chain.js';
import { verifyPhoto } from '../lib/verify.js';
import { friendlyError } from '../lib/errors.js';

const Btn = ({ onClick, children }) => (
  <button className="border border-gray-400 px-3 py-1 rounded text-sm hover:bg-gray-100" onClick={onClick}>{children}</button>
);
const Num = ({ label, value, set }) => (
  <label className="text-sm">{label}{' '}
    <input className="border w-20 px-1" value={value} onChange={(e) => set(e.target.value)} />
  </label>
);

export default function Dev() {
  const [out, setOut] = useState([]);
  const [file, setFile] = useState(null);
  const [last, setLast] = useState({});          // last compressed blob, its hash, its cid
  const [eqId, setEqId] = useState('0');
  const [loanId, setLoanId] = useState('0');
  const [name, setName] = useState('Test item');
  const [depTez, setDepTez] = useState('5');
  const [penTez, setPenTez] = useState('0');
  const [paste, setPaste] = useState({ cid: '', hash: '' }); // use when a photo was uploaded earlier

  const log = (x) => setOut((o) => [typeof x === 'string' ? x : JSON.stringify(x, null, 2), ...o]);
  const run = (label, fn) => async () => {
    try { log(`${label}: ...`); const r = await fn(); log(`${label}: OK ${r === undefined ? '' : JSON.stringify(r)}`); }
    catch (e) { log(`${label}: FAILED -> ${friendlyError(e)}\n   raw: ${e?.message}`); console.error(e); }
  };
  const mutez = (t) => Math.round(Number(t) * 1_000_000);
  const state = (s) => log('   tx state: ' + s);
  const cid = () => last.cid || paste.cid;
  const hash = () => last.hash || paste.hash;

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">/dev control panel {chain.IS_MOCK ? '(MOCK mode)' : '(REAL chain)'}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">1. Wallet</h2>
        <Btn onClick={run('connect', async () => { const a = await chain.connectWallet(); return { address: a, balanceMutez: await chain.getBalanceMutez(a) }; })}>Connect wallet</Btn>
        {chain.IS_MOCK && ['Admin', 'StudentA', 'StudentB'].map((n) => (
          <Btn key={n} onClick={run('switch ' + n, async () => chain.mockSetSender(n))}>as {n}</Btn>))}
        {chain.IS_MOCK && <Btn onClick={run('seed', async () => chain.mockSeed())}>Seed mock items</Btn>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. Photo: compress, hash, upload</h2>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
        <div className="flex flex-wrap gap-2">
          <Btn onClick={run('compress+hash', async () => {
            const blob = await compressImage(file); const h = await sha256Hex(blob);
            setLast({ blob, hash: h }); return { before: file.size, after: blob.size, hash: h, stable: h === (await sha256Hex(blob)) };
          })}>Compress + hash</Btn>
          <Btn onClick={run('upload IPFS', async () => {
            const c = await uploadToIpfs(last.blob); setLast((l) => ({ ...l, cid: c })); return { cid: c, url: photoUrl(c) };
          })}>Upload to IPFS</Btn>
        </div>
        <div className="text-xs">Reuse an earlier photo: cid <input className="border w-64" value={paste.cid} onChange={(e) => setPaste({ ...paste, cid: e.target.value })} /> hash <input className="border w-64" value={paste.hash} onChange={(e) => setPaste({ ...paste, hash: e.target.value })} /></div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">3. Contract actions (sign with the matching wallet!)</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Num label="equipment id" value={eqId} set={setEqId} />
          <Num label="loan id" value={loanId} set={setLoanId} />
          <Num label="deposit tez" value={depTez} set={setDepTez} />
          <Num label="penalty tez" value={penTez} set={setPenTez} />
          <label className="text-sm">name <input className="border w-32 px-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={run('Admin: register', () => chain.registerEquipment(name, mutez(depTez), state))}>Admin: register item</Btn>
          <Btn onClick={run('Student: request checkout', () => chain.requestCheckout(Number(eqId), cid(), hash(), mutez(depTez), state))}>Student: request checkout</Btn>
          <Btn onClick={run('Admin: approve checkout', () => chain.approveCheckout(Number(loanId), hash(), state))}>Admin: approve checkout</Btn>
          <Btn onClick={run('Admin: reject checkout', () => chain.rejectCheckout(Number(loanId), state))}>Admin: reject checkout</Btn>
          <Btn onClick={run('Student: cancel', () => chain.cancelRequest(Number(loanId), state))}>Student: cancel request</Btn>
          <Btn onClick={run('Student: request return', () => chain.requestReturn(Number(loanId), cid(), hash(), state))}>Student: request return</Btn>
          <Btn onClick={run('Admin: approve return', () => chain.approveReturn(Number(loanId), hash(), mutez(penTez), state))}>Admin: approve return</Btn>
          <Btn onClick={run('Admin: reject return', () => chain.rejectReturn(Number(loanId), state))}>Admin: reject return</Btn>
        </div>
        <p className="text-xs text-gray-600">Approve calls send the hash of the photo currently loaded above, so load the SAME photo the student used (or paste its cid+hash).</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">4. Read + verify</h2>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={run('equipment', () => chain.listEquipment())}>List equipment</Btn>
          <Btn onClick={run('loans', () => chain.listLoans())}>List loans</Btn>
          <Btn onClick={run('history', () => chain.listHistory())}>History</Btn>
          <Btn onClick={run('admin', () => chain.getAdmin())}>Get admin</Btn>
          <Btn onClick={run('verify', () => verifyPhoto({ cid: cid(), onchainHash: hash() }))}>Verify (fetch from IPFS)</Btn>
          <Btn onClick={run('verify file', () => verifyPhoto({ cid: cid(), onchainHash: hash(), file }))}>Verify (dropped file)</Btn>
          <Btn onClick={run('verify simulated tamper', () => verifyPhoto({ cid: cid(), onchainHash: hash(), simulateTamper: true }))}>Simulate tampering</Btn>
        </div>
      </section>

      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-[50vh] whitespace-pre-wrap">{out.join('\n')}</pre>
    </div>
  );
}
