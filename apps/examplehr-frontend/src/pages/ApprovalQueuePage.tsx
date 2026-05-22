import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { TimeOffRequest } from '../services/api';
import { RequestStatusBadge } from '../components/RequestStatusBadge';

export function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = useQuery({
    queryKey: ['time-off', 'pending'],
    queryFn: async () => {
      const { data } = await api.get<TimeOffRequest[]>('/time-off/pending');
      return data;
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/time-off/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/time-off/${id}/reject`, { reason: 'Not approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Approval Queue</h1>
      {!pending?.length ? (
        <p className="text-slate-500">No pending requests.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {(r as TimeOffRequest & { employee?: { fullName: string } }).employee?.fullName || r.employeeId}
                  </p>
                  <p className="text-sm text-slate-500">
                    {r.startDate} – {r.endDate} · {r.requestedDays} days
                  </p>
                  {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => approve.mutate(r.id)}
                  disabled={approve.isPending}
                  className="rounded bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                  className="rounded border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
