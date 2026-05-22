import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { Balance } from '../services/api';

const schema = z.object({
  locationId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  requestedDays: z.coerce.number().min(0.5),
  reason: z.string().optional(),
}).refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

type FormData = z.infer<typeof schema>;

export function NewRequestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: balances } = useQuery({
    queryKey: ['balances', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Balance[]>('/balances/me');
      return data;
    },
  });

  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { requestedDays: 1 },
  });

  const locationId = watch('locationId');
  const requestedDays = watch('requestedDays');
  const selectedBalance = balances?.find((b) => b.locationId === locationId);
  const remaining = selectedBalance
    ? selectedBalance.cachedBalanceDays - (requestedDays || 0)
    : null;

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/time-off', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      navigate('/time-off');
    },
    onError: (err: { response?: { data?: { error?: string; availableDays?: number; message?: string } } }) => {
      const data = err.response?.data;
      if (data?.error === 'INSUFFICIENT_BALANCE') {
        setError('requestedDays', {
          message: data.message || `Only ${data.availableDays} days available`,
        });
      }
    },
  });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New Time-Off Request</h1>
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <label className="block">
          <span className="text-sm text-slate-600">Location</span>
          <select {...register('locationId')} className="mt-1 w-full rounded border px-3 py-2">
            <option value="">Select location</option>
            {balances?.map((b) => (
              <option key={b.locationId} value={b.locationId}>
                {b.locationName} ({b.cachedBalanceDays} days)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Start Date</span>
          <input type="date" {...register('startDate')} className="mt-1 w-full rounded border px-3 py-2" />
          {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">End Date</span>
          <input type="date" {...register('endDate')} className="mt-1 w-full rounded border px-3 py-2" />
          {errors.endDate && <p className="text-sm text-red-600">{errors.endDate.message}</p>}
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Days Requested</span>
          <input
            type="number"
            step="0.5"
            {...register('requestedDays')}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          {errors.requestedDays && (
            <p className="text-sm text-red-600">{errors.requestedDays.message}</p>
          )}
          {remaining !== null && locationId && (
            <p className={`mt-1 text-sm ${remaining < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              Remaining after request: {remaining.toFixed(1)} days
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Reason (optional)</span>
          <textarea {...register('reason')} className="mt-1 w-full rounded border px-3 py-2" rows={3} />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-primary-600 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
