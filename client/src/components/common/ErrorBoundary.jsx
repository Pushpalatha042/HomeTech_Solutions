import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERROR_BOUNDARY] Unhandled React error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container page-pad" style={{ textAlign: 'center', padding: '80px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <div
            style={{
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              width: '72px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}
          >
            <AlertCircle size={38} color="#dc2626" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-navy)' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--secondary-text)', marginTop: '8px', fontSize: '14px', lineHeight: '1.5' }}>
            We encountered an unexpected error while displaying this page. Your data is safe.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn btn-navy btn-small"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Try Again
            </button>
            <a
              href="/customer/dashboard"
              className="btn btn-outline btn-small"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Home size={14} /> Return to Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
