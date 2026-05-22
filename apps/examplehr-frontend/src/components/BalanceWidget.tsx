import { useQuery } from '@tanstack/react-query';
import api, { Balance } from '../services/api';

export function BalanceWidget() {
  const { data: balances, isLoading, isFetching } = useQuery({
    queryKey: ['balances', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Balance[]>('/balances/me');
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse rounded-lg bg-white p-6 shadow">Loading balances…</div>;
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leave Balances</h2>
        {isFetching && (
          <span className="text-sm text-primary-600">Syncing…</span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {balances?.map((b) => (
          <div
            key={b.locationId}
            className={`rounded-lg border p-4 ${b.isStale ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
          >
            <p className="text-sm text-slate-500">{b.locationName || 'Location'}</p>
            <p className="text-2xl font-bold text-primary-700">
              {b.cachedBalanceDays} <span className="text-base font-normal">days</span>
            </p>
            {b.isStale && (
              <p className="mt-1 text-xs text-amber-600">Balance may be updating</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
