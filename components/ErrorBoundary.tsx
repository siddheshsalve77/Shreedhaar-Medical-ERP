import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center border-l-4 border-red-500">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong.</h1>
                <p className="text-gray-600 mb-4">The application encountered an unexpected error.</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-teal-800 text-white rounded hover:bg-teal-900 transition"
                >
                    Reload Application
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
