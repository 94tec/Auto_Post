// routes/PublicRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * PublicRoute
 * For auth pages: login, register, forgot-password etc.
 *
 * - If still initialising → spinner (prevents flash of login form
 *   for users who are already logged in)
 * - If fully authenticated + active → redirect to home or original
 *   destination
 * - Otherwise → render children (the auth page)
 */
const PublicRoute = ({ children }) => {
  const { user, loading, authInitialized } = useAuth();
  const location = useLocation();
  const from     = location.state?.from?.pathname || '/';

  // Don't flash login form while session is resolving
  if (loading || !authInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  // Fully active user → send them home (or where they came from)
  if (user && user.emailVerified && user.adminApproved && !user.mustChangePassword) {
    return <Navigate to={from === '/auth/login' ? '/' : from} replace />;
  }

  return children;
};

export default PublicRoute;