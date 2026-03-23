import React from 'react'
import ReactDOM from "react-dom/client";
import './index.css'
import App from './App.jsx'
import ErrorBoundary from "./components/ErrorBoundary";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const client = new QueryClient();


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);