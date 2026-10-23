import React, { useState } from 'react';
import { CreateWallet } from './components/CreateWallet';
import { CheckBalance } from './components/CheckBalance';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'balance'>('balance');

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
      </nav>

      <main className="tab-content">
        {activeTab === 'create' ? <CreateWallet /> : <CheckBalance />}
      </main>
    </div>
  );
};

export default App;
