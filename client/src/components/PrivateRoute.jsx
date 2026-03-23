// components/PrivateRoute.jsx
// Guards entire routes.  Replaces the existing PrivateRoute in App.jsx.
//
// Usage:
//   <PrivateRoute>              — any logged-in user
//     <Dashboard />
//   </PrivateRoute>
//
//   <PrivateRoute requiredRole="admin">   — admin only
//     <AdminPanel />
//   </PrivateRoute>
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  selectUser,
  selectRole,
  selectAuthLoading,
  selectRoleLoading,
  ROLES,
} from '../store/authSlice';
import LoadingSpinner from './LoadingSpinner';

const PrivateRoute = ({ children, requiredRole = null }) => {
  const user        = useSelector(selectUser);
  const role        = useSelector(selectRole);
  const authLoading = useSelector(selectAuthLoading);
  const roleLoading = useSelector(selectRoleLoading);
  const location    = useLocation();

  // Still resolving auth state
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0E1A]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Not logged in → send to login, preserve intended destination
  if (!user || role === ROLES.GUEST) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Logged in but wrong role (e.g. non-admin hitting admin route)
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;