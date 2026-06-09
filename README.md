# 🛡️ Damuchi Admin Platform

A production-ready Firebase + React admin platform with secure cookie authentication, role-based access control, audit logging, CSRF protection, Redis caching, and modern dashboard panes.

## ✨ What it does

Damuchi Admin Platform is built for secure admin and user workflows, including authentication, permissions, approvals, analytics, alerts, and audit trails.

## 🚀 Core features

- 🔐 Cookie-based session auth, no localStorage tokens.
- 🧠 Role-based access for admin, user, and guest accounts.
- 🎛 Granular permissions for read, write, delete, and management.
- 📊 Analytics dashboard for metrics and trends.
- 🚨 Alerts and security feed for operational visibility.
- 🧾 Audit logging for accountability.
- 🧯 CSRF protection for state-changing requests.
- 🚫 Anti-enumeration auth endpoints.
- 🔄 Session revocation on password change.
- ⚡ Redis caching for users, sessions, and stats.
- 🎨 Glassmorphism UI with separate admin and user layouts.

## 📦 Dashboard panes

Two production-grade React panes are included in `src/components/`:

```txt
src/components/
├── AnalyticsPane.jsx
└── AlertsPane.jsx
```

### 📊 AnalyticsPane

Use this pane to visualize platform health and usage data.

**Displays**
- KPI cards.
- Growth trends.
- Signup sources.
- Role distribution.
- Daily activity.
- Recent events.

**Suggested chart types**
- Line chart for growth over time.
- Bar chart for role distribution.
- Pie chart for signup sources.
- Area chart for daily activity.

**Install**
```bash
npm install recharts
npm install framer-motion
```

**Usage**
```jsx
import AnalyticsPane from './components/AnalyticsPane';

<AnalyticsPane />
```

**With real data**
```jsx
<AnalyticsPane
  data={{
    kpis: {
      totalUsers: 312,
      totalUsersChange: +8,
      newSignups: 29,
      newSignupsChange: +5,
      approvalRate: 88,
      approvalRateChange: -2,
      churnRate: 1.8,
      churnRateChange: 0,
    },
    charts: {
      growth: [
        { name: 'Mon', value: 12 },
        { name: 'Tue', value: 18 },
        { name: 'Wed', value: 15 },
      ],
      roleDistribution: [
        { name: 'Admins', value: 12 },
        { name: 'Users', value: 260 },
        { name: 'Guests', value: 40 },
      ],
    },
  }}
/>
```

### 🚨 AlertsPane

Use this pane for security notifications, approval events, warnings, and system messages.

**Displays**
- Critical and warning alerts.
- Approval actions.
- Security incidents.
- System status messages.

**Usage**
```jsx
import AlertsPane from './components/AlertsPane';

<AlertsPane
  alerts={alerts}
  onDismiss={dismiss}
  onAction={handleAction}
/>
```

**Alert shape**
```js
{
  id: 'alert_001',
  type: 'critical',
  title: 'Suspicious login attempt',
  desc: '5 failed logins',
  read: false,
  actions: [
    { label: 'Block IP', variant: 'danger' }
  ]
}
```

## 🎨 Theming

Override global design tokens with CSS variables:

```css
:root {
  --ap-bg: #0B0E14;
  --ap-surface: #111620;
  --ap-border: rgba(255,255,255,0.07);
}
```

## 📱 Responsive layout

| Width | Layout |
|---|---|
| ≥900px | 4 KPI row + 2 chart grid |
| 480–900px | 2 KPI row |
| <480px | Stacked layout |

## 🔐 Security architecture

### Cookies

| Cookie | Type | Lifetime |
|---|---|---|
| `__Host-session` | httpOnly, secure, sameSite=strict, signed | 1h |
| `__refresh` | httpOnly, secure, sameSite=strict, signed | 30d |
| `__csrf` | readable by client | 1h |

### Session fingerprint

The session cookie includes a user-agent fingerprint to help detect stolen cookies, device changes, and replay attempts.

### CSRF protection

All mutating requests require:

```http
X-CSRF-Token: <value from __csrf cookie>
```

Applies to:
- POST
- PATCH
- PUT
- DELETE

### Anti-enumeration protection

These endpoints always return `200`:
- `POST /forgot-password`
- `POST /resend-verification`

This reduces email harvesting and account probing.

### Session revocation

After password change:

```js
await admin.auth().revokeRefreshTokens(uid);
```

This invalidates every active session.

## 🔌 API reference

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create guest account |
| POST | `/login` | Sign in |
| POST | `/logout` | Clear cookies |
| GET | `/me` | Current session |
| POST | `/verify-email` | Verify email |
| POST | `/resend-verification` | Resend link |
| POST | `/forgot-password` | Send reset link |
| POST | `/verify-reset-link` | Validate token |
| POST | `/reset-password` | Change password |

### Users — `/api/users`

| Method | Endpoint |
|---|---|
| POST | `/change-password` |
| PATCH | `/profile` |
| PATCH | `/profile-advanced` |
| DELETE | `/account` |

### Admin — `/api/admin`

| Method | Endpoint |
|---|---|
| POST | `/users` |
| POST | `/users/create-user` |
| GET | `/users` |
| GET | `/users/:uid` |
| POST | `/users/:uid/approve` |
| POST | `/users/:uid/grant-write` |
| POST | `/users/:uid/revoke-write` |
| PATCH | `/users/:uid/permissions` |
| POST | `/users/:uid/suspend` |
| POST | `/users/:uid/reactivate` |
| GET | `/approval-queue` |
| GET | `/pending-write` |
| GET | `/stats` |
| GET | `/audit-logs` |

### Other routes

| Route | Access | Description |
|---|---|---|
| `GET /api/quotes` | optional | Public/admin quotes |
| `GET /api/quotes/my` | user | Own quotes |
| `POST /api/quotes` | write | Create quote |
| `GET /api/lyrics` | public | Cached |
| `POST /api/lyrics` | admin | Create lyric |
| `GET /api/guest-quotes` | public | No auth required |
| `POST /api/contact` | public | Contact form |

## ❌ Error codes

Every error returns:

```json
{
  "code": "ACCOUNT_SUSPENDED",
  "message": "..."
}
```

| Code | Meaning |
|---|---|
| `MISSING_CREDENTIALS` | Missing login fields |
| `INVALID_EMAIL` | Bad email format |
| `WEAK_PASSWORD` | Password too weak |
| `EMAIL_EXISTS` | Already registered |
| `PENDING_VERIFICATION` | Email not verified |
| `INVALID_CREDENTIALS` | Wrong login details |
| `ACCOUNT_SUSPENDED` | Account suspended |
| `EMAIL_NOT_VERIFIED` | Must verify email |
| `AWAITING_APPROVAL` | Admin approval pending |
| `RATE_LIMITED` | Too many attempts |
| `TOKEN_EXPIRED` | Session expired |
| `TOKEN_REVOKED` | Session revoked |
| `LINK_EXPIRED` | Reset link expired |
| `SERVER_ERROR` | Internal server error |

## 🧠 Architecture notes

- Zero external state.
- Lazy chart rendering.
- CSS injected once.
- Motion optional.
- Works with or without `framer-motion`.

## 🧩 Frontend structure

```txt
src/
├── pages/
│   └── ProfileCard.jsx
├── components/
│   ├── AnalyticsPane.jsx
│   ├── AlertsPane.jsx
│   ├── EditProfileModal.jsx
│   └── GlassCard.jsx
├── context/
│   └── AuthContext.jsx
└── api/
    └── client.js
```

## 🔒 Permission model

### Admin
- manageUsers
- delete
- write
- read
- accessAdmin

### User
- read
- write (optional)

### Guest
- read only

## 🧾 Audit events

Examples:
- `USER_LOGIN`
- `USER_LOGOUT`
- `USER_CREATED`
- `USER_APPROVED`
- `USER_SUSPENDED`
- `PASSWORD_CHANGED`
- `QUOTE_CREATED`
- `PERMISSION_UPDATED`

## ⚡ Performance

- Redis user cache.
- Redis session cache.
- Lazy charts.
- Memoized selectors.
- HTTP-only cookies.
- Stateless JWT.

## 🏁 Production checklist

- ✅ CSRF protection.
- ✅ Secure cookies.
- ✅ Session revocation.
- ✅ Audit logs.
- ✅ Role-based access.
- ✅ Permission overrides.
- ✅ Admin approval flow.
- ✅ Write access control.
- ✅ Error code mapping.
- ✅ Rate limiting.
- ✅ Fingerprinted sessions.

## 👤 Author

Damuchi  
Built in Nairobi, Kenya 🇰🇪

Every pixel. Every permission. Every guard. Intentional.