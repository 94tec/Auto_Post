<div align="center">

<br/>

```
  ██████╗  █████╗ ███╗   ███╗██╗   ██╗ ██████╗██╗  ██╗██╗
  ██╔══██╗██╔══██╗████╗ ████║██║   ██║██╔════╝██║  ██║██║
  ██║  ██║███████║██╔████╔██║██║   ██║██║     ███████║██║
  ██║  ██║██╔══██║██║╚██╔╝██║██║   ██║██║     ██╔══██║██║
  ██████╔╝██║  ██║██║ ╚═╝ ██║╚██████╔╝╚██████╗██║  ██║██║
  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝
```

### *Daily Inspiration. Built Different.*

<br/>

[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite_5-1a1a2e?style=flat-square&logo=vite&logoColor=646CFF)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js_18+-1a1a2e?style=flat-square&logo=nodedotjs&logoColor=339933)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express_5-1a1a2e?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-1a1a2e?style=flat-square&logo=firebase&logoColor=FFCA28)](https://firebase.google.com)
[![Redis](https://img.shields.io/badge/Redis-1a1a2e?style=flat-square&logo=redis&logoColor=DC382D)](https://redis.io)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-1a1a2e?style=flat-square&logo=tailwindcss&logoColor=06B6D4)](https://tailwindcss.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-1a1a2e?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io)

<br/>

> A curated personal quote platform with a full auth lifecycle, role-based access control,<br/>
> Redis-backed caching, transactional email, and a premium dark UI.<br/>
> **Built with purpose in Nairobi, Kenya 🇰🇪**

<br/>

</div>

---

## Contents

- [The Stack](#the-stack)
- [Monorepo Layout](#monorepo-layout)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Design System](#design-system)
- [How Auth Works](#how-auth-works)
- [Registration — 14 Steps, One Atomic Flow](#registration--14-steps-one-atomic-flow)
- [Login — A State Machine](#login--a-state-machine)
- [Routes & Guards](#routes--guards)
- [State — Redux + Context Bridge](#state--redux--context-bridge)
- [API Client](#api-client)
- [Redis Architecture](#redis-architecture)
- [Role & Permission System](#role--permission-system)
- [The mustChangePassword Contract](#the-mustchangepassword-contract)
- [Email Service](#email-service)
- [Admin Operations](#admin-operations)
- [Rate Limiting](#rate-limiting)
- [Security Model](#security-model)
- [API Reference](#api-reference)
- [Error Codes](#error-codes)

---

## The Stack

Two apps, one project. The frontend and backend are designed to be deployed independently but are built as a cohesive system.

| | Frontend | Backend |
|--|----------|---------|
| **Runtime** | React 18 + Vite 5 | Node.js 18+ (ESM) |
| **Framework** | — | Express 5 |
| **Styling** | Tailwind CSS + Framer Motion | — |
| **State** | Redux Toolkit + React Query | — |
| **Auth** | Firebase Client SDK | Firebase Admin SDK |
| **Database** | Firebase RTDB (reads) | RTDB + Firestore (dual write) |
| **Cache** | — | Redis Cloud (node-redis v4) |
| **Email** | — | Resend |
| **Real-time** | Socket.io client | Socket.io server |
| **Routing** | React Router v6 | Express Router |
| **Charts** | Recharts | — |

---

## Monorepo Layout

```
damuchi/
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AuthGuard.jsx           ← 5-state route protection
│       │   ├── SessionWatcher.jsx      ← token refresh watcher
│       │   ├── LoginForm.jsx           ← full banner-mapped login card
│       │   ├── RegisterForm.jsx        ← 14-step registration + strength meter
│       │   ├── ChangePassword.jsx      ← force-change (admin flow)
│       │   ├── DailyCard.jsx           ← phone-frame inspiration card
│       │   ├── QuoteList.jsx           ← animated filterable quote grid
│       │   ├── ContactModal.jsx        ← slide-up contact sheet
│       │   └── modals/
│       │       ├── CreateAdminModal.jsx
│       │       └── CreateUserModal.jsx
│       ├── pages/
│       │   ├── Landing.jsx             ← auth-gate hero, 5 sections
│       │   ├── Dashboard.jsx           ← role-aware quote management
│       │   ├── AuthPage.jsx            ← login/register container
│       │   ├── AdminPanel.jsx          ← tabbed admin dashboard
│       │   ├── GuestLanding.jsx        ← awaiting-approval view
│       │   └── VerifyPending.jsx       ← email verification gate
│       ├── context/
│       │   └── AuthContext.jsx         ← Firebase ↔ Redux sync bridge
│       ├── store/
│       │   └── authSlice.js            ← auth state + fetchUserRole thunk
│       ├── hooks/
│       │   └── useRole.js              ← { isAdmin, isUser, isGuest, isAllowed }
│       ├── utils/
│       │   └── api.js                  ← centralised API client + ApiError
│       └── App.jsx                     ← providers + QueryClient + router
│
└── backend/
    └── server/
        ├── config/
        │   ├── firebase.js             ← Admin SDK init
        │   ├── redis.js                ← Redis client + connectRedis()
        │   └── roles.js                ← ROLES, STATUS constants
        ├── controllers/auth/
        │   ├── authHelpers.js          ← shared Redis ops, DB writers, validators
        │   ├── registerController.js
        │   ├── loginController.js
        │   ├── emailVerificationController.js
        │   ├── passwordController.js
        │   └── userController.js
        ├── controllers/
        │   └── adminController.js      ← all admin user management
        ├── routes/
        │   ├── authRoutes.js           ← /api/auth/* (9 endpoints)
        │   ├── adminRoutes.js          ← /api/admin/* (14 endpoints)
        │   ├── quotesRoutes.js
        │   ├── userRoutes.js
        │   ├── lyricsRoutes.js
        │   ├── contactRoutes.js
        │   └── routes.js               ← master router
        ├── middleware/
        │   ├── auth.js                 ← verifyToken (Firebase ID token)
        │   ├── requireAdmin.js
        │   └── rateLimiter.js          ← tiered: api / auth / write
        ├── services/
        │   ├── emailService.js         ← 7 branded HTML email templates
        │   ├── auditLog.js             ← event log → Firestore
        │   ├── sessionService.js       ← Redis session middleware
        │   └── jobQueue.js             ← background worker
        └── index.js                    ← bootstrap: Redis → workers → listen
```

---

## Quick Start

### Prerequisites

- Node.js **18+**
- Firebase project (Auth + Realtime Database + Firestore enabled)
- Redis Cloud instance — [free tier](https://redis.io/try-free/) works fine
- Resend account for transactional email

### Install Both Apps

```bash
git clone https://github.com/your-org/damuchi.git
cd damuchi

# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### Seed Your Admin

Before the first run, set your admin directly in Firebase Realtime Database:

```json
users/{your-uid}/basic: {
  "uid":           "your-uid",
  "email":         "admin@yourdomain.com",
  "role":          "admin",
  "status":        "active",
  "emailVerified": true,
  "adminApproved": true,
  "createdAt":     "2024-01-01T00:00:00.000Z"
}

users/{your-uid}/permissions: {
  "read": true, "write": true, "delete": true,
  "manageUsers": true, "accessAdmin": true
}
```

> This seeded admin has no `createdBy` field — it bypasses the `mustChangePassword` flow entirely and is never forced to reset.

### Run

```bash
# Terminal 1 — backend
cd backend && npm run dev      # → http://localhost:5000

# Terminal 2 — frontend
cd frontend && npm run dev     # → http://localhost:5173
```

The backend prints this on startup:

```
┌────────────────────────────────────────────┐
│  🚀 Damuchi API Running                    │
│                                            │
│  Port:        5000                         │
│  Environment: development                  │
│                                            │
│  Auth    → /api/auth                       │
│  Quotes  → /api/quotes                     │
│  Users   → /api/users                      │
│  Admin   → /api/admin                      │
└────────────────────────────────────────────┘
```

---

## Environment Variables

### Frontend — `frontend/.env.local`

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_API_BASE_URL=http://localhost:5000
```

### Backend — `backend/.env`

```env
# Firebase
FIREBASE_API_KEY=AIza...
# Service account: place serviceAccount.json in config/ or set GOOGLE_APPLICATION_CREDENTIALS

# Redis — Format A (recommended, handles TLS via rediss://)
REDIS_URL=rediss://default:PASSWORD@HOST:PORT

# Redis — Format B (separate vars)
# REDIS_CLOUD_HOST=your-host.redis.cloud
# REDIS_CLOUD_PORT=11784
# REDIS_PASSWORD=your-password

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Damuchi <noreply@damuchi.app>
CONTACT_EMAIL=hello@damuchi.app

# App
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
PORT=5000

# Security — generate with: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
COOKIE_SECRET=your-48-character-random-secret
```

---

## Design System

Dark-first, amber-accented. Every color token is used consistently across both the UI and the HTML email templates — the emails look like the app.

### Core Palette

| Token | Value | Where |
|-------|-------|-------|
| `NAVY` | `#0A0E1A` | Page background |
| `SLATE` | `#141924` | Cards, modals |
| `MID` | `#0D1220` | Inset panels, info boxes |
| `ACCENT` | `#F59E0B` | Primary CTA, links, highlights |
| `ACCENT2` | `#F97316` | Gradient end point |
| Admin | `#818CF8` | Admin-only UI surfaces |

### Quote Category Colors

```
motivation   #F59E0B    mindset      #818CF8    discipline   #34D399
success      #A78BFA    resilience   #FB923C    persistence  #38BDF8
belief       #C084FC    action       #86EFAC    growth       #2DD4BF
determination #F87171   inspiration  #7DD3FC
```

These colors appear on category tags, chart segments, border-left indicators in emails, and the animated category gradient border in `DailyCard`.

### Typography

```
Headings    font-black, letter-spacing: -0.5px
Body        text-[13px]–[14px], text-white/60 for muted
Labels      text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/70
Font stack  -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

---

## How Auth Works

Damuchi uses a **custom token flow** — the backend validates your credentials, checks application-level gates, then issues a Firebase custom token for the client SDK to consume. The client never signs in directly with email/password.

```
LoginForm
  │
  └─► POST /api/auth/login  { email, password }
            │
            ├─ Firebase REST API signInWithPassword → idToken
            ├─ Admin SDK verifyIdToken (revocation check)
            ├─ Load RTDB profile → state machine checks
            ├─ Set httpOnly session cookies + CSRF token
            └─ createCustomToken(uid)
            │
            ▼
      { customToken, user, mustChangePassword? }
            │
            └─► signInWithCustomToken(auth, customToken)
                        │
                        ▼
                  onAuthStateChanged fires
                        │
                        ▼
                  AuthContext dispatches fetchUserRole(uid)
                        │
                        ▼
                  authSlice reads RTDB users/{uid}/basic
                        │
                        ▼
                  Redux store populated
                        │
                        ▼
                  AuthGuard routes to the right destination
```

**Why not let the client sign in directly?** Firebase Auth has no concept of `SUSPENDED`, `AWAITING_APPROVAL`, or `mustChangePassword`. Those are application-level states. The backend must own that gate — and it does.

---

## Registration — 14 Steps, One Atomic Flow

Every step runs in sequence. Any failure after step 8 triggers a **full rollback** — Firebase Auth user, RTDB record, Firestore record, and Redis cache entries are all deleted.

```
POST /api/auth/register  { name, email, password }

 1   Field presence             → 400 MISSING_FIELDS
 2   Email format (RFC regex)   → 400 INVALID_EMAIL
 3   Name length 2–50           → 400 INVALID_NAME_LENGTH
 4   Password strength (5 rules)→ 400 WEAK_PASSWORD
 5   Redis NX lock (30s)        → 429 REGISTRATION_IN_PROGRESS
 6   Redis fast dup check O(1)  → 409 EMAIL_EXISTS
 7   Firebase Auth dup check    → 409 EMAIL_EXISTS / PENDING_VERIFICATION
 8   admin.auth().createUser()  ← Firebase Auth user created
 9   RTDB multi-path write      ← role=guest, status=pending
10   Firestore mirror write     ← parallel with step 9
11   Redis cache warm           ← email→uid (7d), uid→profile (2h)
12   Release NX lock
13   sendWelcomeEmail()         ← fire-and-forget
14   AuditLog.record()          ← fire-and-forget

→ 201 { success, message, nextSteps[], user{} }

ROLLBACK (steps 9–11 fail):
  admin.auth().deleteUser(uid)
  adminDb.ref(`users/${uid}`).remove()
  firestore.doc(uid).delete()
  rDel(emailToUid), rDel(profile)
```

### Password Rules

Five rules, all checked server-side:

```
✓  8+ characters
✓  One uppercase   [A-Z]
✓  One lowercase   [a-z]
✓  One number      [0-9]
✓  One symbol      [^A-Za-z0-9]
```

The frontend `RegisterForm` mirrors these with an animated 5-bar strength meter and rule checklist. The backend is the source of truth — the UI is just helpful feedback.

---

## Login — A State Machine

The login controller runs five ordered checks before issuing any token. Checks are ordered specifically to prevent information leakage — a suspended user cannot discover their verification state by probing.

```
SUSPENDED           → 403  ACCOUNT_SUSPENDED     (always checked first)
!emailVerified      → 403  EMAIL_NOT_VERIFIED    (non-admin only)
!adminApproved      → 403  AWAITING_APPROVAL     (non-admin only)
status = pending    → 403  PENDING_ACTIVATION    (edge case guard)
mustChangePassword  → 200  + flag in response    (admin + createdBy only)
─────────────────────────────────────────────
All pass            → 200  { customToken, user }
```

**Admin bypass:** Admins skip the email verification and admin approval gates entirely. An admin account is always fully active — it only hits the `mustChangePassword` check if it was created by another admin (the triple guard: `mustChangePassword && role === 'admin' && createdBy`).

---

## Routes & Guards

### Full Route Map

```
Public
  /                         Landing — auth-gated hero (5 IntersectionObserver sections)
  /docs                     Documentation
  /quotes                   Public quote browser
  /guest                    GuestLanding — awaiting approval view

Auth Flow
  /auth/*                   AuthPage (login + register tabs)
  /auth/verify-pending      Email verification holding page
  /auth/verify-email        oobCode consumer (handles Firebase link)
  /auth/welcome             Post-verification welcome
  /auth/forgot-password     Forgot password form
  /auth/reset-password      oobCode → new password form
  /auth/change-password     Force-change (admin flow only)
  /auth/resend-verification  Resend verification request

Protected
  /dashboard                Verified + approved users, admins
  /admin                    Admin role only
```

### AuthGuard — 5 States, Strict Order

```jsx
// Every protected route wraps in AuthGuard
<Route path="/dashboard" element={
  <AuthGuard requireApproved>
    <Dashboard />
  </AuthGuard>
} />

// The change-password page doesn't enforce approval
// (it's how an unapproved admin gets approved)
<Route path="/auth/change-password" element={
  <AuthGuard requireApproved={false}>
    <ChangePasswordPage />
  </AuthGuard>
} />
```

The guard checks in this exact order — the first failure wins:

| # | Condition | Redirect | Notes |
|---|-----------|----------|-------|
| 1 | Auth loading | — | Shows spinner |
| 2 | No session | `/auth/login` | |
| 3 | Status = `suspended` | `/auth/login` | Toast shown |
| 4 | Admin + `mustChangePassword` | `/auth/change-password` | Admin only |
| 5 | Email not verified | `/auth/verify-pending` | Non-admin only |
| 6 | Not admin-approved | `/guest` | Non-admin only |
| 7 | All clear | Render children | |

---

## State — Redux + Context Bridge

### Store Shape

```typescript
auth: {
  user:               { uid, email, displayName, photoURL } | null
  role:               'admin' | 'user' | 'guest'
  emailVerified:      boolean
  adminApproved:      boolean
  status:             'pending' | 'awaiting' | 'active' | 'suspended'
  mustChangePassword: boolean
  loading:            boolean
  roleLoading:        boolean
  error:              string | null
}
```

`fetchUserRole(uid)` is an async thunk that reads `users/{uid}/basic` from RTDB first, falls back to Firestore on error, and populates the entire slice. It runs every time `onAuthStateChanged` fires a non-null user.

### AuthContext Bridge

`AuthContext.jsx` merges Firebase Auth state with the Redux slice into a single unified `user` object so components don't need to import from two sources:

```js
const { user } = useAuth();

user.uid               // from Firebase Auth
user.email             // from Firebase Auth
user.role              // from Redux ← RTDB
user.emailVerified     // from Redux ← RTDB
user.adminApproved     // from Redux ← RTDB
user.status            // from Redux ← RTDB
user.mustChangePassword // from Redux ← RTDB
```

### useRole Hook

```js
const { isAdmin, isUser, isGuest, isAllowed, loading } = useRole();

if (isAllowed(['admin', 'user'])) {
  // show write actions
}
```

---

## API Client

`src/utils/api.js` is the single HTTP gateway for the frontend. Every request goes through it.

### What It Does Automatically

- Attaches `Authorization: Bearer {firebaseIdToken}` on every request
- Reads `__csrf` cookie → sends as `X-CSRF-Token` on all mutating requests
- Silently refreshes the Firebase token on `401 TOKEN_EXPIRED` and retries once
- `authApi.login()` calls `/api/auth/login`, receives `customToken`, and calls `signInWithCustomToken` — no manual SDK calls needed

### Usage

```js
import { authApi, quotesApi, adminApi, lyricsApi, contactApi, userApi } from '@/utils/api';

// Auth
await authApi.register({ name, email, password });
await authApi.login({ email, password });
await authApi.forgotPassword(email);
await authApi.resetPassword({ oobCode, newPassword });

// Quotes
const { quotes } = await quotesApi.getAll({ category: 'motivation' });
await quotesApi.create({ text, author, category });
await quotesApi.update(id, { text });
await quotesApi.delete(id);

// Admin
await adminApi.approveUser(uid);
await adminApi.createAdmin({ email, password, displayName });
await adminApi.grantWrite(uid);
await adminApi.suspendUser(uid);
const { stats } = await adminApi.getStats();
const { queue } = await adminApi.getQueue();

// User account
await userApi.changePassword(newPassword);
await userApi.updateProfile({ displayName });
await userApi.deleteAccount();
```

### Error Handling

The `ApiError` class carries the full backend error shape:

```js
import { ApiError } from '@/utils/api';

try {
  await authApi.login({ email, password });
} catch (err) {
  if (err instanceof ApiError) {
    err.code     // 'INVALID_CREDENTIALS'
    err.message  // 'Incorrect email or password.'
    err.hint     // 'Try resetting your password.'
    err.missing  // ['email'] — which fields were absent
    err.failed   // ['length', 'uppercase'] — which password rules failed
    err.status   // 401
  }
}
```

---

## Redis Architecture

Redis is not optional infrastructure — it is woven into the request lifecycle for registration locks, duplicate detection, profile caching, session data, and cooldowns.

### Key Schema

```
reg:email:{email}         uid string        7 days    email → uid lookup
reg:uid:{uid}             JSON profile      2 hours   warm profile cache
reg:lock:{email}          '1'               30 sec    registration idempotency lock
resend:cool:{email}       '1'               2 min     resend verification cooldown
session:{uid}             session JSON      1 hour    session data
vlock:{uid}:{oobSuffix}   '1'               60 sec    email verify idempotency lock
```

### Helpers — All Non-Throwing

```js
// authHelpers.js
await rGet(K.profile(uid));                         // null on miss or Redis down
await rSet(K.emailToUid(email), uid, TTL.EMAIL_UID); // silent on error
await rDel(K.profile(uid));                         // safe cache bust
await rSetNX(K.regLock(email), '1', TTL.REG_LOCK);  // null if already locked
```

All helpers are wrapped in try/catch. **A Redis failure never breaks an endpoint** — it degrades gracefully to the DB layer.

### Invalidation Pattern

```
User registered    → set email→uid, uid→profile
User approved      → del uid→profile
User suspended     → del uid→profile
Password changed   → del uid→profile
Email changed      → del old email→uid, set new email→uid
Admin creates user → set email→uid, uid→profile immediately
```

---

## Role & Permission System

### Roles

```
guest     Registered, email not yet verified or not yet approved
user      Verified + approved. Can read. Write permission granted separately.
admin     Full access. Manages users. Bypasses all verification gates.
```

### Account Statuses

```
pending     Registered, email not verified
awaiting    Email verified, waiting for admin approval
active      Fully approved and operational
suspended   Blocked at login — cannot authenticate
```

### Permissions (per-user in RTDB + Firestore)

```
read         Can read quotes
write        Can create and edit quotes (granted by admin separately)
delete       Can delete quotes
manageUsers  Admin: approve, suspend, manage users
accessAdmin  Admin: access /admin panel
```

### Middleware Stack

```js
// Public read
router.get('/', apiLimiter, optionalAuth, getQuotes);

// Requires verified + approved account
router.post('/', writeLimiter, verifyToken, requirePermission('write'), createQuote);

// Admin only
router.post('/admin/users', verifyToken, requireAdmin, createAdmin);
```

### Role Table

| Role | Verified | Approved | Status | Destination |
|------|:--------:|:--------:|--------|-------------|
| `guest` | ❌ | ❌ | `pending` | `/auth/verify-pending` |
| `guest` | ✅ | ❌ | `awaiting` | `/guest` |
| `user` | ✅ | ✅ | `active` | `/dashboard` |
| `admin` | ✅ | ✅ | `active` | `/dashboard` + `/admin` |
| any | — | — | `suspended` | Blocked at login |

---

## The mustChangePassword Contract

When an admin creates another admin via `POST /api/admin/users`, the new account is born with a temporary password and a flag that enforces a password change before anything else happens. This is a full-stack contract — backend sets it, frontend enforces it, clearing it requires both sides.

```
Admin A → POST /api/admin/users  { email, password, displayName }
              │
              ▼
        adminController.createAdmin
          RTDB:       basic/mustChangePassword: true
                      basic/createdBy: AdminA.uid
          Firestore:  mustChangePassword: true
          Redis:      profile cache primed with flag
          Email:      sendAdminWelcomeEmail  (temp password included)
              │
              ▼
        Admin B logs in
              │
        loginController triple guard:
          mustChangePassword === true
          && role === 'admin'
          && createdBy !== undefined
              │
              ▼
        Response: { success, customToken, mustChangePassword: true }
              │
              ▼
        AuthGuard: isAdmin && mustChangePassword
          → redirect /auth/change-password  (every navigation, no escape)
              │
              ▼
        Admin B sets new password
        POST /api/users/change-password  { newPassword }
              │
              ▼
        userController.changePassword
          admin.auth().updateUser(uid, { password })
          admin.auth().revokeRefreshTokens(uid)    ← all other sessions killed
          Promise.allSettled([
            RTDB:    mustChangePassword: false,
            Firestore: mustChangePassword: false,
            Redis:   rDel(K.profile(uid))           ← bust cache
          ])
          return { success, mustChangePassword: false }
              │
              ▼
        Frontend: dispatch fetchUserRole(uid)
          → Redux flag clears
          → AuthGuard re-evaluates → passes
          → navigate('/dashboard')
```

The seeded admin (no `createdBy` field) is **never** subject to this flow. The triple guard fails at the third condition.

---

## Email Service

Seven fully branded HTML email templates. Same dark design system as the UI — navy background, amber accents, gradient CTA buttons. Every template uses inline styles for maximum email client compatibility.

All sends are wrapped in `safeSend` — **a failed email never breaks the calling endpoint**.

| Template | Trigger | Key Content |
|----------|---------|-------------|
| `sendWelcomeEmail` | Registration | 3-step onboarding guide |
| `sendVerificationReminder` | Resend request | Verification link + plain URL fallback |
| `sendAdminNotification` | Email verified | New user details + link to approval queue |
| `sendApprovalEmail` | Admin approves | Access granted + unlocked features |
| `sendPasswordChangedEmail` | Password change | Security alert with IP + device info |
| `sendAdminWelcomeEmail` | Admin created | Temp password + next-steps |
| `sendContactEmail` | Contact form | Forwarded with reply-to set |
| `sendQuoteDigest` | Job queue | Daily inspiration digest (top 3 quotes) |

---

## Admin Operations

`adminController.js` manages all admin user operations with Redis cache awareness and full audit trail.

### createAdmin
Creates a new admin account, bypassing the normal registration flow. Sets `mustChangePassword: true` and `createdBy: creatorUid`. Primes Redis immediately. Sends admin welcome email with the temporary password. Records `ADMIN_CREATED` audit event.

### createUser
Creates a pre-approved user — skips the entire `guest → verify → approve` lifecycle. Explicitly sets `mustChangePassword: false` at the RTDB, Firestore, and Redis layer. Regular users are **never** subject to force-change. Records `USER_CREATED_BY_ADMIN` audit event.

### approveUser
Promotes `role=guest` → `role=user`, `status=active`. Busts the user's Redis cache. Sends `sendApprovalEmail`. Records both `GUEST_APPROVED` and `GUEST_PROMOTED` events (two events because the state change is meaningful on its own, even if they always happen together).

### Audit Events

```
USER_REGISTERED      EMAIL_VERIFICATION     EMAIL_VERIFICATION_RESEND
USER_LOGIN           LOGIN_FAILED           USER_LOGOUT
PASSWORD_CHANGED     PASSWORD_RESET_*       PROFILE_UPDATED
ACCOUNT_DELETED      GUEST_APPROVED         GUEST_PROMOTED
USER_SUSPENDED       USER_REACTIVATED       PERMISSION_GRANTED
PERMISSION_REVOKED   PERMISSION_OVERRIDE    ADMIN_CREATED
USER_CREATED_BY_ADMIN LYRIC_CREATED         LYRIC_DELETED
```

---

## Rate Limiting

Tiered limiters. Stricter on auth, looser on reads.

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `apiLimiter` | 15 min | 300 | All `/api/*` — global soft ceiling |
| `authLimiter` | 15 min | 20 | Login, forgot-password |
| `writeLimiter` | 15 min | 50 | Register, create, reset password |
| Contact limiter | 10 min | 5 | `POST /api/contact` (per IP) |

---

## Security Model

### Session Cookies

Three cookies, each with a specific role and TTL:

```
__Host-session    httpOnly  secure  sameSite=strict  signed   1 hour
__refresh         httpOnly  secure  sameSite=strict  signed   30 days  path=/auth/refresh
__csrf            NOT httpOnly (client reads it)     signed   1 hour
```

The session cookie appends a 16-character UA fingerprint to the ID token — `Buffer.from(userAgent.slice(0,64)).toString('base64').slice(0,16)` — to help detect stolen tokens across devices.

### CSRF

All `POST`, `PATCH`, `PUT`, `DELETE` requests require the `X-CSRF-Token` header to match the `__csrf` cookie. The token is regenerated on every login.

### Anti-Enumeration

`forgotPassword` and `resendVerification` always return `200` regardless of whether the email exists in the system. This prevents using the API as an email oracle.

### Session Revocation

After any password change or reset, **all existing sessions are invalidated**:

```js
await admin.auth().revokeRefreshTokens(fbUser.uid);
```

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Rate | Auth | Description |
|--------|----------|------|------|-------------|
| `POST` | `/register` | write | — | Create guest account |
| `POST` | `/login` | auth | — | Sign in → custom token |
| `POST` | `/logout` | api | — | Clear session cookies |
| `GET` | `/me` | api | ✅ | Current user from session |
| `POST` | `/verify-email` | api | — | Consume oobCode |
| `POST` | `/resend-verification` | api | — | Re-send link (2 min cooldown) |
| `POST` | `/forgot-password` | auth | — | Email reset link |
| `POST` | `/verify-reset-link` | api | — | Validate oobCode before form |
| `POST` | `/reset-password` | write | — | Set new password, revoke sessions |

### Users — `/api/users`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/change-password` | Change password, revoke all sessions |
| `PATCH` | `/profile` | Update display name |
| `PATCH` | `/profile-advanced` | Update email (triggers re-verification) |
| `DELETE` | `/account` | Soft-delete DB + hard-delete Auth |

### Admin — `/api/admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/users` | Create new admin |
| `POST` | `/users/create-user` | Create pre-approved user |
| `GET` | `/users` | List users (filter by role, status) |
| `GET` | `/users/:uid` | Get user (Redis-cached) |
| `POST` | `/users/:uid/approve` | Approve guest → user |
| `POST` | `/users/:uid/grant-write` | Grant write permission |
| `POST` | `/users/:uid/revoke-write` | Revoke write permission |
| `PATCH` | `/users/:uid/permissions` | Patch permission flags |
| `POST` | `/users/:uid/suspend` | Suspend account |
| `POST` | `/users/:uid/reactivate` | Reactivate account |
| `GET` | `/approval-queue` | Users awaiting approval |
| `GET` | `/pending-write` | Active users without write access |
| `GET` | `/stats` | Platform stats |
| `GET` | `/audit-logs` | Recent audit events |

### Other Routes

| Base | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/quotes` | `GET` | Optional | All (admin) or public |
| `/api/quotes/my` | `GET` | ✅ | Current user's quotes |
| `/api/quotes` | `POST` | ✅ write perm | Create quote |
| `/api/lyrics` | `GET` | — | All lyrics (cached 10 min) |
| `/api/lyrics` | `POST` | ✅ Admin | Create lyric |
| `/api/guest-quotes` | `GET` | — | Public, no auth |
| `/api/contact` | `POST` | — | Submit contact form |

---

## Error Codes

Every error from the API has a `code` field. The frontend maps each code to a specific banner with title, icon, color, and contextual hint.

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_CREDENTIALS` | 400 | Email or password absent |
| `MISSING_FIELDS` | 400 | Required body fields absent |
| `INVALID_EMAIL` | 400 | Email format invalid |
| `INVALID_NAME_LENGTH` | 400 | Name not 2–50 chars |
| `WEAK_PASSWORD` | 400 | Password fails strength rules |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `PENDING_VERIFICATION` | 409 | Registered, email not verified |
| `REGISTRATION_IN_PROGRESS` | 429 | Idempotency lock active (30s) |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_SUSPENDED` | 403 | Suspended by admin |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified (non-admin login) |
| `AWAITING_APPROVAL` | 403 | Verified, not yet approved |
| `PENDING_ACTIVATION` | 403 | Status edge case |
| `TOO_MANY_ATTEMPTS` | 429 | Firebase brute-force limit |
| `USER_RECORD_MISSING` | 500 | RTDB profile absent for Auth user |
| `RATE_LIMITED` | 429 | App-level rate limit |
| `TOKEN_EXPIRED` | 401 | Firebase ID token expired |
| `TOKEN_REVOKED` | 401 | Session revoked server-side |
| `LINK_EXPIRED` | 410 | oobCode expired |
| `INVALID_LINK` | 400 | oobCode used or malformed |
| `SERVER_ERROR` | 500 | Unexpected server error |

---

<div align="center">

<br/>

*Every pixel, every route guard, every error code — intentional.*

<br/>

**Damuchi** · Built in **Nairobi, Kenya 🇰🇪**

</div>