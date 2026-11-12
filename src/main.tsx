import './polyfills';
import './styles/tokens.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { logger } from './utils/logger';

// AC 4 & Task 5: Safety net to prevent unhandled promise rejections leaking into console
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // Prevent unhandled promise rejection from printing uncaught error to console
    event.preventDefault();
    logger.error('Unhandled Promise Rejection caught:', event.reason);
  });

  window.addEventListener('error', (event) => {
    logger.error('Uncaught error caught:', event.error || event.message);
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
