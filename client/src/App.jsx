// App.jsx — merge of both, File 1 as base

import { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Navigate, useLocation,
} from 'react-router-dom';
import { Provider }        from 'react-redux';
import store               from './store';
import { AuthProvider }    from './context/AuthContext';
import { ThemeProvider }   from './context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence }          from 'framer-motion';
import LoadingSpinner    from './components/LoadingSpinner';
import ErrorBoundary     from './components/ErrorBoundary';
import AuthGuard         from './components/AuthGuard';
import SessionWatcher    from './components/SessionWatcher';
import { Toaster }       from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries:   { retry: 1, staleTime: 60_000 },
    mutations: { retry: 0 },
  },
});

/* ── lazy pages ─────────────────────────────────────────────── */
const Landing            = lazy(() => import('./pages/Landing'));
const GuestLanding       = lazy(() => import('./pages/GuestLanding'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const AdminPanel         = lazy(() => import('./pages/AdminPanel'));
const DocsPage           = lazy(() => import('./pages/DocsPage'));
const AuthPage           = lazy(() => import('./pages/AuthPage'));
const VerifyPending      = lazy(() => import('./pages/VerifyPending'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const ChangePassword     = lazy(() => import('./components/ChangePassword'));
const ForgotPassword     = lazy(() => import('./components/ForgotPassword'));
const ResetPassword      = lazy(() => import('./components/ResetPassword'));
const ResendVerification = lazy(() => import('./components/ResendVerification'));
const VerifyEmailHandler = lazy(() => import('./components/EmailVerificationHandler'));
const WelcomeVerifyEmail = lazy(() => import('./components/WelcomeVerifyEmail'));
const QuoteFeature       = lazy(() => import('./components/QuoteFeature'));
const QuoteForm          = lazy(() => import('./components/QuoteForm'));
const QuoteList          = lazy(() => import('./components/QuoteList'));
const QuoteCard          = lazy(() => import('./components/QuoteCard'));

// ✅ Fix from File 2 — use named export DailyCardPage for the standalone route
const DailyCard     = lazy(() => import('./components/DailyCard'));
const DailyCardPage = lazy(() =>
  import('./components/DailyCard').then(m => ({
    default: m.DailyCardPage ?? m.default,
  }))
);

/* ── loaders + transitions ───────────────────────────────────── */
const PageLoader = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-50"
       style={{ background: '#0A0E1A' }}>
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="w-10 h-10 rounded-[14px] flex items-center justify-center
                      font-black text-[17px] shadow-lg"
           style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', color: '#0A0E1A' }}>
        D
      </div>
    </motion.div>
    <LoadingSpinner size="medium" />
  </div>
);

function RouteTransition({ children }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0,  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
        exit={{    opacity: 0, y: -6, transition: { duration: 0.18, ease: 'easeIn' } }}
        style={{ minHeight: '100vh' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const page = (Component) => (
  <RouteTransition>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  </RouteTransition>
);

/* ── routes ──────────────────────────────────────────────────── */
function AppRoutes() {
  return (
    <Routes>

      {/* ── public ── */}
      <Route path="/"                          element={page(Landing)}            />
      <Route path="/guest"                     element={page(GuestLanding)}       />
      <Route path="/docs"                      element={page(DocsPage)}           />
      <Route path="/auth/*"                    element={page(AuthPage)}           />
      <Route path="/auth/verify-email"         element={page(VerifyEmailHandler)} />
      <Route path="/auth/verify-pending"       element={page(VerifyPending)}      />
      <Route path="/auth/welcome"              element={page(WelcomeVerifyEmail)} />
      <Route path='/auth/forgot-password'      element={page(ForgotPassword)}      />
      <Route path="/auth/reset-password"       element={page(ResetPassword)}      />
      <Route path="/auth/change-password"      element={page(ChangePassword)}     />
      <Route path="/auth/resend-verification"  element={page(ResendVerification)} />

      {/* ── component showcases ── */}
      <Route path="/quotesCards"  element={page(DailyCardPage)} />  {/* ✅ fixed */}
      <Route path="/quoteCard"    element={page(QuoteCard)}     />
      <Route path="/quoteFeature" element={page(QuoteFeature)}  />
      <Route path="/quoteForm"    element={page(QuoteForm)}     />
      <Route path="/quoteList"    element={page(QuoteList)}     />

      <Route path="/auth/force-password-change" element={
        <AuthGuard requireApproved={false}>
          <ForcePasswordChange />
        </AuthGuard>
      } />

      {/* ── protected: verified + approved ── */}
      <Route path="/dashboard" element={
        <AuthGuard requireApproved>
          {page(Dashboard)}
        </AuthGuard>
      } />

      {/* ── protected: admin only ── */}
      <Route path="/admin" element={
        <AuthGuard requireApproved>
          {page(AdminPanel)}
        </AuthGuard>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const toastOptions = {
  position: 'top-center',
  style: {
    background:   '#141924',
    color:        '#fff',
    border:       '1px solid rgba(255,255,255,0.08)',
    fontSize:     '13px',
    borderRadius: '12px',
    padding:      '10px 14px',
  },
  success: { iconTheme: { primary: '#4ade80', secondary: '#141924' } },
  error:   { iconTheme: { primary: '#f87171', secondary: '#141924' } },
};

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-[#0A0E1A] text-white">
          <Router>
            <ThemeProvider>
              <AuthProvider>
                <SessionWatcher />
                <AppRoutes />
                <Toaster {...toastOptions} />
              </AuthProvider>
            </ThemeProvider>
          </Router>
        </div>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;