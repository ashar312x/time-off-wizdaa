import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { TimeOffRequest } from '../services/api';
import { RequestStatusBadge } from '../components/RequestStatusBadge';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: request, isLoading } = useQuery({
    queryKey: ['time-off', id],
    queryFn: async () => {
      const { data } = await api.get<TimeOffRequest>(`/time-off/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/time-off/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      navigate('/time-off');
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (!request) return <p>Request not found</p>;

  return (
    <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Request Details</h1>
        <RequestStatusBadge status={request.status} />
      </div>
      <dl className="space-y-2 text-sm">
        <div><dt className="text-slate-500">Dates</dt><dd>{request.startDate} – {request.endDate}</dd></div>
        <div><dt className="text-slate-500">Days</dt><dd>{request.requestedDays}</dd></div>
        {request.reason && <div><dt className="text-slate-500">Reason</dt><dd>{request.reason}</dd></div>}
      </dl>
      {request.status === 'PENDING' && (
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          className="mt-6 rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Cancel Request
        </button>
      )}
    </div>
  );
}
