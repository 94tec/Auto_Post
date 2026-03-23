// components/SessionWatcher.jsx
// Mounts once at the root level. Watches Firebase ID token expiry
// and forces logout + redirect to /auth/login when session expires.
// Firebase tokens expire after 1 hour; refresh tokens keep users
// signed in silently until revoked.
//
// Usage in App.jsx — place inside AuthProvider:
//   <AuthProvider>
//     <SessionWatcher />
//     <AppRoutes />
//   </AuthProvider>

import { useEffect, useRef } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser as reduxSetUser } from '../store/authSlice';
import toast from 'react-hot-toast';

const CHECK_INTERVAL_MS = 60 * 1000; // check every 60s

const SessionWatcher = () => {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const timerRef  = useRef(null);
  const hasResolved = useRef(false); // track if we've ever received a valid user



  useEffect(() => {
    // Firebase automatically refreshes ID tokens.
    const unsub = onIdTokenChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            // Ignore the initial null before Firebase resolves auth state
            if (!hasResolved.current) return;

            dispatch(reduxSetUser(null));
            toast.error('Your session has expired. Please sign in again.', {
            id: 'session-expired', duration: 5000,
            });
            navigate('/auth/login', { replace: true });
        } else {
            hasResolved.current = true;
        }
    });

    // Secondary periodic check: detect if tab was inactive for a long time
    // and Firebase hasn't fired the event yet
    timerRef.current = setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        // Force token refresh — throws if token is invalid/revoked
        await user.getIdToken(true);
      } catch {
        dispatch(reduxSetUser(null));
        toast.error('Session expired. Please sign in.', { id: 'session-expired' });
        navigate('/auth/login', { replace: true });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      unsub();
      clearInterval(timerRef.current);
    };
  }, [navigate, dispatch]);

  return null; // renders nothing
};

export default SessionWatcher;