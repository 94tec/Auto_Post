// routes/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * ProtectedRoute
 * Waits for authInitialized before making ANY redirect decision.
 * This eliminates the race condition where routes render before
 * Firebase + RTDB have resolved the user's role.
 *
 * Props:
 *   children        — page to render when access is granted
 *   requireAdmin    — true → only role=admin passes
 *   requireApproved — false → skip adminApproved check (default true)
 */
const ProtectedRoute = ({
  children,
  requireAdmin    = false,
  requireApproved = true,
}) => {
  const { user, loading, authInitialized } = useAuth();
  const location = useLocation();

  // ── Still initialising — make NO routing decision yet ──────────
  if (loading || !authInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  // ── Not logged in ───────────────────────────────────────────────
  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // ── Must change temporary password ─────────────────────────────
  if (user.mustChangePassword) {
    return <Navigate to="/auth/change-password" replace />;
  }

  // ── Email not verified ──────────────────────────────────────────
  if (!user.emailVerified) {
    return <Navigate to="/auth/verify-pending" replace />;
  }

  // ── Verified but not admin-approved ────────────────────────────
  if (requireApproved && !user.adminApproved) {
    return <Navigate to="/guest" replace />;
  }

  // ── Admin-only route ────────────────────────────────────────────
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;