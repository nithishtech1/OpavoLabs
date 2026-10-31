const EXPLORER = import.meta.env.VITE_EXPLORER_BASE || 'https://shadownet.tzkt.io';

export default function Receipt({ opHash, label }) {
  if (!opHash) return null;
  return (
    <div className="text-sm text-gray-600 mt-2">
      {label && <span>{label} </span>}
      <a href={`${EXPLORER}/${opHash}`} target="_blank" rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-mono text-xs">
        {opHash.slice(0, 8)}...{opHash.slice(-6)}
      </a>
      {' '}(view on TzKT)
    </div>
  );
}
