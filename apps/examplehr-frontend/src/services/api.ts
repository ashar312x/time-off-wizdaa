import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
}

export interface Balance {
  locationId: string;
  locationName?: string;
  cachedBalanceDays: number;
  isStale: boolean;
  lastSyncedAt: string;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  createdAt: string;
  employee?: { fullName: string; email: string };
}
