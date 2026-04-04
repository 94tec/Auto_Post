// store/authSlice.js
// Holds user identity + role fetched from Firestore.
// Role is stored separately from Firebase Auth so it can be
// updated without re-authenticating.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/* ── role constants ──────────────────────────────────────── */
export const ROLES = {
  ADMIN: 'admin',
  USER:  'user',
  GUEST: 'guest',
};

/* ── async: fetch role — reads RTDB first, Firestore as fallback ── */
// Your seedAdmin writes to RTDB at users/{uid}/basic/role
// AND to Firestore at users/{uid}.role
// We try RTDB first (source of truth), then Firestore, then default.
export const fetchUserRole = createAsyncThunk(
  'auth/fetchUserRole',
  async (uid, { rejectWithValue }) => {
    try {
      // ── 1. Try Firebase Realtime Database (primary — where seedAdmin writes) ──
      try {
        const { getDatabase, ref, get } = await import('firebase/database');
        const rtdb     = getDatabase();
        const snap     = await get(ref(rtdb, `users/${uid}/basic`));
        if (snap.exists()) {
          const basic = snap.val();
          console.log('📡 RTDB fetch result:', basic);
          // Return full profile so AuthContext can merge it into user object
          return {
            role:          basic.role          ?? ROLES.USER,
            emailVerified: basic.emailVerified ?? false,
            adminApproved: basic.adminApproved ?? false,
            status:        basic.status        ?? 'pending',
            mustChangePassword: basic.mustChangePassword ?? false,
            displayName:   basic.displayName   ?? null,
            permissions:   null, // loaded separately if needed
          };
        }
      } catch (rtdbErr) {
        console.warn('[fetchUserRole] RTDB read failed, trying Firestore:', rtdbErr.message);
      }

      // ── 2. Firestore fallback ──
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data();
        return {
          role:          d.role          ?? ROLES.USER,
          emailVerified: d.emailVerified ?? false,
          adminApproved: d.adminApproved ?? false,
          status:        d.status        ?? 'pending',
          displayName:   d.displayName   ?? null,
          permissions:   null,
        };
      }

      // ── 3. Brand-new user — create Firestore doc with guest defaults ──
      await setDoc(doc(db, 'users', uid), {
        role:          ROLES.USER,
        adminApproved: false,
        emailVerified: false,
        status:        'pending',
        createdAt:     serverTimestamp(),
      });
      return {
        role:          ROLES.USER,
        emailVerified: false,
        adminApproved: false,
        status:        'pending',
        displayName:   null,
        permissions:   null,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

/* ── slice ───────────────────────────────────────────────── */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:          null,          // serialisable Firebase user fields
    role:          ROLES.GUEST,
    emailVerified: false,         // from RTDB/Firestore — not Firebase Auth token
    adminApproved: false,         // admin-approved flag from DB
    status:        'pending',     // pending | awaiting | active | suspended
    mustChangePassword: false,         // admin temp-password flag — force change on first login
    loading:       true,          // true until first auth state resolved
    roleLoading:   false,
    error:         null,
    authInitialized: false,         // becomes true after first auth state change (even if user is null) — used to prevent flashing "Sign In" on app load while Firebase Auth checks local storage
  },
  reducers: {
    setUser(state, { payload }) {
      state.user    = payload;
      state.loading = false;
      if (!payload) {
        // Signed out — reset everything and mark initialized immediately
        // (no role fetch needed when there's no user)
        state.role               = ROLES.GUEST;
        state.emailVerified      = false;
        state.adminApproved      = false;
        state.status             = 'pending';
        state.mustChangePassword = false;
        state.error              = null;
        state.roleLoading        = false;
        state.authInitialized    = true;
      }
    },
    setLoading(state, { payload }) {
      state.loading = payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserRole.pending, (state) => {
        state.roleLoading     = true;
        state.authInitialized = false;
        state.error           = null;
      })
      .addCase(fetchUserRole.fulfilled, (state, { payload }) => {
        state.role               = payload.role               ?? ROLES.USER;
        state.emailVerified      = payload.emailVerified      ?? false;
        state.adminApproved      = payload.adminApproved      ?? false;
        state.status             = payload.status             ?? 'pending';
        state.mustChangePassword = payload.mustChangePassword ?? false;
        state.roleLoading        = false;
        state.authInitialized    = true; // ← both checks done, safe to route
 
        if (state.user && payload.displayName && !state.user.displayName) {
          state.user.displayName = payload.displayName;
        }
      })
      .addCase(fetchUserRole.rejected, (state, { payload }) => {
        // Always set initialized even on failure — app must not hang forever
        state.role            = ROLES.USER;
        state.roleLoading     = false;
        state.authInitialized = true;
        state.error           = payload;
      });
  },
});

export const { setUser, setLoading, clearError } = authSlice.actions;
export default authSlice.reducer;

/* ── selectors ───────────────────────────────────────────── */
export const selectUser          = (s) => s.auth.user;
export const selectRole          = (s) => s.auth.role;
export const selectEmailVerified = (s) => s.auth.emailVerified;
export const selectAdminApproved = (s) => s.auth.adminApproved;
export const selectStatus        = (s) => s.auth.status;
export const selectMustChangePassword = (s) => s.auth.mustChangePassword;
export const selectAuthLoading   = (s) => s.auth.loading;
export const selectRoleLoading   = (s) => s.auth.roleLoading;
export const selectAuthInitialized    = (s) => s.auth.authInitialized;
export const selectIsAdmin       = (s) => s.auth.role === ROLES.ADMIN;
export const selectIsGuest       = (s) => s.auth.role === ROLES.GUEST;