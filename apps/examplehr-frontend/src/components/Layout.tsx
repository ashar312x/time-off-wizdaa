import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="text-xl font-bold text-primary-700">
            ExampleHR
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-sm hover:text-primary-600">Dashboard</Link>
            <Link to="/time-off" className="text-sm hover:text-primary-600">Time Off</Link>
            {isManager && (
              <Link to="/manager/approvals" className="text-sm hover:text-primary-600">
                Approvals
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin/sync" className="text-sm hover:text-primary-600">
                Sync
              </Link>
            )}
            <span className="text-sm text-slate-500">{user?.fullName}</span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="rounded bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
