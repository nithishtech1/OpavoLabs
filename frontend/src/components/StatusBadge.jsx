const statusConfig = {
  AVAILABLE: { label: 'Available', cls: 'bg-green-50 text-green-700 border-green-200' },
  RESERVED: { label: 'Awaiting approval', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CHECKOUT_PENDING: { label: 'Awaiting approval', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CHECKED_OUT: { label: 'Checked out', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  RETURN_PENDING: { label: 'Return pending', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  CLOSED: { label: 'Returned', cls: 'bg-gray-50 text-gray-700 border-gray-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-50 text-gray-700 border-gray-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
  ACTIVE: { label: 'Checked out', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};
export default function StatusBadge({ status }) {
  const cfg = statusConfig[status] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
