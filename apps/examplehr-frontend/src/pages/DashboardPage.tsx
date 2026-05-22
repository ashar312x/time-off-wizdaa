import { Link } from 'react-router-dom';
import { BalanceWidget } from '../components/BalanceWidget';
import { useQuery } from '@tanstack/react-query';
import api, { TimeOffRequest } from '../services/api';
import { RequestStatusBadge } from '../components/RequestStatusBadge';

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['time-off', 'recent'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeOffRequest[] }>('/time-off?limit=5');
      return data.data;
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          to="/time-off/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Request Time Off
        </Link>
      </div>
      <BalanceWidget />
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Recent Requests</h2>
        {!data?.length ? (
          <p className="text-slate-500">No time-off requests yet.</p>
        ) : (
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <Link to={`/time-off/${r.id}`} className="hover:text-primary-600">
                  {r.startDate} → {r.endDate} ({r.requestedDays} days)
                </Link>
                <RequestStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
