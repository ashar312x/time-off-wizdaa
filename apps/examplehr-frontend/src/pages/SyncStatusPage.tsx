import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface SyncStatus {
  lastRun: {
    id: string;
    status: string;
    recordsUpdated: number | null;
    recordsFailed: number | null;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  nextScheduledSync: string | null;
}

export function SyncStatusPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: async () => {
      const { data } = await api.get<SyncStatus>('/sync/status');
      return data;
    },
  });

  const trigger = useMutation({
    mutationFn: () => api.post('/sync/trigger'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
  });

  if (isLoading) return <p>Loading…</p>;

  const last = status?.lastRun;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Sync Status</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Last Sync Status</dt>
            <dd className="font-medium">{last?.status || 'Never run'}</dd>
          </div>
          {last?.startedAt && (
            <div>
              <dt className="text-slate-500">Last Started</dt>
              <dd>{new Date(last.startedAt).toLocaleString()}</dd>
            </div>
          )}
          {last?.completedAt && (
            <div>
              <dt className="text-slate-500">Last Completed</dt>
              <dd>{new Date(last.completedAt).toLocaleString()}</dd>
            </div>
          )}
          {last?.recordsUpdated != null && (
            <div>
              <dt className="text-slate-500">Records Updated</dt>
              <dd>{last.recordsUpdated}</dd>
            </div>
          )}
          {status?.nextScheduledSync && (
            <div>
              <dt className="text-slate-500">Next Scheduled Sync</dt>
              <dd>{new Date(status.nextScheduledSync).toLocaleString()}</dd>
            </div>
          )}
          {last?.errorMessage && (
            <div>
              <dt className="text-slate-500">Error</dt>
              <dd className="text-red-600">{last.errorMessage}</dd>
            </div>
          )}
        </dl>
        <button
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
          className="mt-6 rounded-lg bg-primary-600 px-6 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {trigger.isPending ? 'Syncing…' : 'Trigger Manual Sync'}
        </button>
      </div>
    </div>
  );
}
