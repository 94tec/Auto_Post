import React from "react";
import { FiAlertTriangle, FiRefreshCw, FiHome, FiMail } from "react-icons/fi";
import { motion } from "framer-motion";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("💥 Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
    // Example: Log to error tracking service
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleReportError = () => {
    const { error, errorInfo } = this.state;
    const subject = encodeURIComponent("Bug Report");
    const body = encodeURIComponent(
      `Error: ${error?.toString()}\n\nStack: ${errorInfo?.componentStack}\n\nUser Agent: ${navigator.userAgent}`
    );
    window.location.href = `mailto:support@yourdomain.com?subject=${subject}&body=${body}`;
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-red-700 p-6 text-white"
        >
          <div className="max-w-2xl w-full bg-black/20 rounded-xl p-8 backdrop-blur-sm border border-red-400/30 shadow-xl">
            <div className="flex flex-col items-center text-center mb-6">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="mb-4"
              >
                <FiAlertTriangle className="text-red-300" size={60} />
              </motion.div>
              <h1 className="text-3xl font-bold mb-2">Oops! Something went wrong</h1>
              <p className="text-red-100 mb-6">
                We've encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-4 mb-6">
              <div className="font-mono text-sm text-red-100 mb-2">
                {this.state.error?.toString()}
              </div>
              
              {this.state.showDetails && this.state.errorInfo && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-auto max-h-60 mt-2 p-2 bg-black/40 rounded text-xs"
                >
                  {this.state.errorInfo.componentStack}
                </motion.pre>
              )}

              <button
                onClick={this.toggleDetails}
                className="text-xs mt-2 text-red-200 hover:text-white transition-colors"
              >
                {this.state.showDetails ? "Hide details" : "Show error details"}
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                <FiRefreshCw />
                Reload App
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <FiHome />
                Go to Home
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={this.handleReportError}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <FiMail />
                Report Error
              </motion.button>
            </div>

            <div className="mt-6 text-center text-xs text-red-200/70">
              <p>Error ID: {Math.random().toString(36).substring(2, 10)}</p>
              <p className="mt-1">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;