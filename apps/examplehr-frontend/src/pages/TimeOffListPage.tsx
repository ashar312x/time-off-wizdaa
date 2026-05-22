import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api, { TimeOffRequest } from '../services/api';
import { RequestStatusBadge } from '../components/RequestStatusBadge';

export function TimeOffListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['time-off', 'list'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeOffRequest[] }>('/time-off');
      return data.data;
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Time-Off Requests</h1>
        <Link
          to="/time-off/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
        >
          New Request
        </Link>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-3">{r.startDate} – {r.endDate}</td>
                  <td className="px-4 py-3">{r.requestedDays}</td>
                  <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/time-off/${r.id}`} className="text-primary-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
