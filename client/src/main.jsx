import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';

import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';

import { ShareProvider } from './context/ShareContext';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';

const queryClient = new QueryClient({
  defaultOptions: {
    queries:   { retry: 1, staleTime: 60_000 },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ShareProvider>
            <App />
          </ShareProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);