import React, { useState } from 'react';
import './CheckBalance.css';

export const CheckBalance: React.FC = () => {
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<string | null>(null);

  const handleCheckBalance = () => {
    // Mocked data as per task requirement
    setBalance('10 TON');
  };

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h2 className="wallet-title">Check Balance</h2>

        <div className="wallet-section">
          <label htmlFor="ton-address" className="wallet-label">
            TON Address:
          </label>
          <input
            id="ton-address"
            type="text"
            className="wallet-input"
            placeholder="Enter TON address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="wallet-section">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCheckBalance}
          >
            Check Balance
          </button>
        </div>

        {balance !== null && (
          <div className="wallet-section balance-result" data-testid="balance-display">
            <span className="balance-label">Balance:</span>
            <span className="balance-value">{balance}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckBalance;
