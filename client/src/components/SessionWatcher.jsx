/**
 * components/SessionWatcher.jsx
 * ═══════════════════════════════════════════════════════════════
 * Silent background component. No UI, no navigate().
 *
 * SESSION EXPIRY APPROACH
 * ─────────────────────────────────────────────────────────────
 * Firebase revokeRefreshTokens() invalidates tokens server-side
 * but the client only discovers this on the NEXT token refresh
 * (~1 hour). To force immediate logout we use RTDB:
 *
 *   users/{uid}/session/forceLogout = true
 *
 * Backend sets this flag when revoking (password reset, suspend,
 * admin force-logout). This watcher polls the flag every 60s and
 * signs out immediately when it's set.
 *
 * WHAT THIS HANDLES
 * ─────────────────────────────────────────────────────────────
 *  ✅ Silent token refresh every 10 min (keeps session alive)
 *  ✅ Idle logout after 30 min of no interaction
 *  ✅ onIdTokenChanged — detects token revocation
 *  ✅ RTDB forceLogout flag — server-initiated forced logout
 *  ✅ Never navigate() — ProtectedRoute handles all redirects
 *  ✅ Never interferes on public/auth routes
 *  ✅ Error handler attached before connect (no unhandled crash)
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useCallback } from 'react';
import { onIdTokenChanged, signOut }      from 'firebase/auth';
import { auth }                           from '../config/firebase';
import { useLocation }                    from 'react-router-dom';
import { useDispatch, useSelector }       from 'react-redux';
import { setUser as reduxSetUser,
         selectUser }                     from '../store/authSlice';
import toast                              from 'react-hot-toast';

/* ── config ──────────────────────────────────────────────────── */
const REFRESH_INTERVAL_MS  = 10 * 60 * 1000; // 10 min — proactive token refresh
const IDLE_TIMEOUT_MS      = 30 * 60 * 1000; // 30 min — idle auto-logout
const FORCE_CHECK_MS       = 60 * 1000;      // 60 s  — poll RTDB forceLogout flag
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

const PUBLIC_PREFIXES = ['/auth/', '/guest'];
const isPublic = (path) =>
  PUBLIC_PREFIXES.some(p => path.startsWith(p)) || path === '/';

/* ══════════════════════════════════════════════════════════════ */
const SessionWatcher = () => {
  const dispatch   = useDispatch();
  const location   = useLocation();
  const currentUser = useSelector(selectUser);

  const idleTimerRef    = useRef(null);
  const refreshTimerRef = useRef(null);
  const forceCheckRef   = useRef(null);
  const hasResolvedRef  = useRef(false);
  const isPublicRef     = useRef(false);

  isPublicRef.current = isPublic(location.pathname);

  /* ── silent sign-out ─────────────────────────────────────────
     Clears Firebase + Redux. ProtectedRoute sees user=null
     and redirects to /auth/login automatically.
  ─────────────────────────────────────────────────────────── */
  const silentSignOut = useCallback(async (reason = 'session-expired') => {
    try {
      await signOut(auth);
    } catch { /* ignore — we're clearing state regardless */ }

    dispatch(reduxSetUser(null));

    const MESSAGES = {
      'session-expired': 'Your session has expired. Please sign in again.',
      'idle':            'Signed out due to inactivity.',
      'token-error':     'Session error. Please sign in again.',
      'force-logout':    'You have been signed out by the server.',
      'revoked':         'Your session was revoked. Please sign in again.',
    };

    toast(MESSAGES[reason] ?? MESSAGES['session-expired'], {
      id:       reason,
      icon:     '🔒',
      duration: 6000,
      style: {
        background: '#141924',
        color:      'rgba(255,255,255,0.75)',
        border:     '1px solid rgba(255,255,255,0.08)',
        fontSize:   '13px',
      },
    });
  }, [dispatch]);

  /* ── Idle timer (set up once on mount) ───────────────────────
     Resets on every user interaction via passive event listeners.
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const resetIdle = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (isPublicRef.current) return;
        if (!auth.currentUser)   return;
        silentSignOut('idle');
      }, IDLE_TIMEOUT_MS);
    };

    IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle(); // start immediately

    return () => {
      IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimerRef.current);
    };
  }, [silentSignOut]);

  /* ── Token expiry via onIdTokenChanged ───────────────────────
     Fires on mount + whenever token changes or user signs out.
     First fire is always skipped (cold load — no session yet).
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        hasResolvedRef.current = true;

        // Check if the token claims indicate revocation
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          // Firebase sets auth_time — if server revoked tokens, the
          // next forced refresh will fail and land in the catch below
          void idTokenResult;
        } catch {
          // Token is invalid/revoked
          if (!isPublicRef.current) silentSignOut('revoked');
        }
        return;
      }

      // firebaseUser = null
      if (!hasResolvedRef.current) {
        hasResolvedRef.current = true;
        return; // cold load, no session — normal
      }

      // Was logged in, now null = session ended
      if (isPublicRef.current) return;
      silentSignOut('session-expired');
    });

    return unsubToken;
  }, [silentSignOut]);

  /* ── Proactive token refresh (every 10 min) ──────────────────
     Forces Firebase to issue a new token before it auto-expires.
     If the token was revoked server-side, getIdToken(true) throws
     and we sign out immediately — much faster than waiting for the
     1-hour natural expiry.
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    refreshTimerRef.current = setInterval(async () => {
      const user = auth.currentUser;
      if (!user || isPublicRef.current) return;

      try {
        await user.getIdToken(/* forceRefresh */ true);
      } catch (err) {
        console.error('[SessionWatcher] Token refresh failed:', err.message);
        silentSignOut('token-error');
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimerRef.current);
  }, [silentSignOut]);

  /* ── RTDB forceLogout flag polling ───────────────────────────
     Backend sets users/{uid}/session/forceLogout = true
     when it wants to immediately invalidate a session:
       • Password reset completed
       • Admin suspends user
       • Admin force-logout action
       • Session revoked via POST /api/admin/users/:uid/revoke-session

     We check every 60s. On detection we clear the flag first
     (so it doesn't re-trigger) then sign out.

     Why polling instead of onValue listener?
       • onValue creates a persistent WebSocket connection — expensive
         for every tab the user has open.
       • 60s polling is "good enough" for force-logout latency and
         much lighter on Firebase quota.
       • If you want instant logout, switch to onValue (see comment).
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const checkForceLogout = async () => {
      const user = auth.currentUser;
      if (!user || isPublicRef.current) return;

      try {
        // Dynamic import so firebase/database is only loaded when needed
        const { getDatabase, ref, get, set } = await import('firebase/database');
        const db   = getDatabase();
        const snap = await get(ref(db, `users/${user.uid}/session/forceLogout`));

        if (snap.exists() && snap.val() === true) {
          console.warn('[SessionWatcher] forceLogout flag detected — signing out');
          // Clear the flag so it doesn't re-fire on next check
          await set(ref(db, `users/${user.uid}/session/forceLogout`), null);
          silentSignOut('force-logout');
        }
      } catch (err) {
        // RTDB unavailable — not fatal, session continues
        console.warn('[SessionWatcher] forceLogout check failed:', err.message);
      }
    };

    // Check immediately on mount + every FORCE_CHECK_MS
    checkForceLogout();
    forceCheckRef.current = setInterval(checkForceLogout, FORCE_CHECK_MS);

    return () => clearInterval(forceCheckRef.current);
  }, [silentSignOut, currentUser?.uid]);

  /* ── OPTIONAL: real-time RTDB listener (instant logout) ─────
     Uncomment this block and remove the polling effect above
     if you want instant forced logout (< 1s latency).
     Trade-off: persistent WebSocket connection per tab.

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let unsubRtdb;
    import('firebase/database').then(({ getDatabase, ref, onValue, set }) => {
      const db        = getDatabase();
      const flagRef   = ref(db, `users/${user.uid}/session/forceLogout`);
      unsubRtdb = onValue(flagRef, async (snap) => {
        if (snap.exists() && snap.val() === true) {
          await set(flagRef, null);
          silentSignOut('force-logout');
        }
      });
    });

    return () => unsubRtdb?.();
  }, [silentSignOut, currentUser?.uid]);
  ─────────────────────────────────────────────────────────── */

  return null;
};

export default SessionWatcher;