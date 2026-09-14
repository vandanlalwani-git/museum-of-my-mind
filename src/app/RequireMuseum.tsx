import { Navigate, Outlet } from 'react-router-dom';
import { useMuseumStore } from '@/store/museum';

/** Rooms cannot be entered until a museum is active. */
export function RequireMuseum() {
  const status = useMuseumStore((s) => s.status);
  const hydrated = useMuseumStore((s) => s.hydrated);
  if (status !== 'ready') return null;
  if (!hydrated) return <Navigate to="/" replace />;
  return <Outlet />;
}
