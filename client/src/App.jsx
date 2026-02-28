import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

// Lazy load pages for better performance
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Landing = lazy(() => import("./pages/Landing"));
const ChangePassword = lazy(() => import("./components/ChangePassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const ResendVerification = lazy(() => import("./components/ResendVerification"));
const VerifyEmailHandler = lazy(() => import("./components/EmailVerificationHandler"));
const WelcomeVerifyEmail = lazy(() => import("./components/WelcomeVerifyEmail"));
const DailyCard = lazy(() => import("./components/DailyCard"));
const QuoteCard = lazy(() => import("./components/QuoteCard"));
const QuoteFeature = lazy(() => import("./components/QuoteFeature"));
const QuoteForm = lazy(() => import("./components/QuoteForm"));
const QuoteList = lazy(() => import("./components/QuoteList"));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return user ? (
    children
  ) : (
    <Navigate 
      to="/auth/login" 
      state={{ from: location }} 
      replace 
    />
  );
}

function RouteTransition({ children }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <Landing />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/auth/verify-email" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <VerifyEmailHandler />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/auth/*" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <AuthPage />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } /> 
      <Route path="/auth/welcome" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <WelcomeVerifyEmail />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/auth/reset-password" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <ResetPassword />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/auth/change-password" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <ChangePassword />
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/auth/resend-verification" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <ResendVerification />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/cards" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <DailyCard />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/cards2" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <QuoteCard />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
        <Route path="/cards3" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <QuoteFeature />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
        <Route path="/cards4" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <QuoteForm />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
        <Route path="/cards5" element={
        <RouteTransition>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              <QuoteList />  
            </Suspense>
          </ErrorBoundary>
        </RouteTransition>
      } />
      <Route path="/dashboard" element={
        <PrivateRoute>
          <RouteTransition>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner size="large" />}>
                <Dashboard />
              </Suspense>
            </ErrorBoundary>
          </RouteTransition>
        </PrivateRoute>
      } />

      <Route path="*" element={
        <Navigate to="/" replace />
      } />
    </Routes>
  );
}
// Toast configuration
const toastOptions = {
  position: "top-center",
  style: {
    background: '#1e293b',
    color: '#fff',
    border: '1px solid #334155'
  },
  success: {
    iconTheme: {
      primary: '#4ade80',
      secondary: '#1e293b'
    }
  },
  error: {
    iconTheme: {
      primary: '#f87171',
      secondary: '#1e293b'
    }
  }
};

function App() {
  return (
    <div className="min-h-screen bg-[#0b0b1a] text-white">
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster {...toastOptions} />
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </div>
  );
}

export default App;