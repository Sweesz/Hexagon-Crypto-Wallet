import React, { useState } from 'react';
import { CreateWallet } from './components/CreateWallet';
import { CheckBalance } from './components/CheckBalance';
import { SendTransaction } from './components/SendTransaction';
import { ToastProvider } from './components/Toast';
import './App.css';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'balance' | 'send'>('balance');

  return (
    <div className="app-container">
      <nav className="tab-navigation">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Wallet
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveTab('balance')}
        >
          Check Balance
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          Send TON
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'create' && <CreateWallet />}
        {activeTab === 'balance' && <CheckBalance />}
        {activeTab === 'send' && <SendTransaction />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
