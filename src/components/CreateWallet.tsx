import React from 'react';
import './CreateWallet.css';

const MOCK_MNEMONIC =
  'apple banana cherry dog elephant fox grape horse igloo jaguar kangaroo lemon mango nut orange pear queen rabbit snake tiger umbrella violet wolf zebra';

export const CreateWallet: React.FC = () => {
  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h2 className="wallet-title">Create Wallet</h2>

        <div className="wallet-section">
          <button type="button" className="btn-primary">
            Generate New Wallet
          </button>
        </div>

        <div className="wallet-section">
          <label htmlFor="mnemonic-phrase" className="wallet-label">
            Mnemonic Phrase:
          </label>
          <textarea
            id="mnemonic-phrase"
            className="wallet-textarea"
            rows={4}
            readOnly
            value={MOCK_MNEMONIC}
          />
        </div>

        <div className="wallet-section">
          <button type="button" className="btn-secondary">
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateWallet;
