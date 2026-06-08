/**
 * PrivacyMode page - Privacy and security settings
 */

import type { PrivacyConfig, PrivacyMode as PrivacyModeType } from '../backend/types';

interface PrivacyModeProps {
  privacy: PrivacyConfig;
  onPrivacyModeChange: (mode: PrivacyModeType) => void;
  onMacSpoofingChange: (enabled: boolean) => void;
  onEncryptPersistenceChange: (enabled: boolean) => void;
  onPersistencePassphraseChange: (passphrase: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function PrivacyMode({
  privacy,
  onPrivacyModeChange,
  onMacSpoofingChange,
  onEncryptPersistenceChange,
  onPersistencePassphraseChange,
  onBack,
  onNext,
}: PrivacyModeProps) {
  return (
    <div className="installer-page privacy-mode-page">
      <h2>Privacy & Security</h2>
      <p className="page-description">
        Configure how elizaOS handles your network privacy and data security.
      </p>

      <div className="form-section">
        <h3>Network Mode</h3>
        <p className="section-description">
          Choose how elizaOS connects to the internet.
        </p>

        <div className="privacy-mode-options">
          <button
            type="button"
            className={`privacy-mode-card ${
              privacy.mode === 'direct' ? 'selected' : ''
            }`}
            onClick={() => onPrivacyModeChange('direct')}
          >
            <div className="mode-icon">🌐</div>
            <div className="mode-content">
              <h4>Direct Connection</h4>
              <p>
                Fast, unrestricted internet access. Best for daily use and cloud
                AI providers.
              </p>
            </div>
            <div className="mode-radio">
              <div
                className={`radio-indicator ${
                  privacy.mode === 'direct' ? 'checked' : ''
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            className={`privacy-mode-card ${
              privacy.mode === 'tor' ? 'selected' : ''
            }`}
            onClick={() => onPrivacyModeChange('tor')}
          >
            <div className="mode-icon">🧅</div>
            <div className="mode-content">
              <h4>Privacy Mode (Tor)</h4>
              <p>
                Route all traffic through Tor for anonymity. Slower speeds, some
                services may be blocked.
              </p>
            </div>
            <div className="mode-radio">
              <div
                className={`radio-indicator ${
                  privacy.mode === 'tor' ? 'checked' : ''
                }`}
              />
            </div>
          </button>
        </div>

        {privacy.mode === 'tor' && (
          <div className="privacy-mode-warning">
            <p>
              ⚠️ <strong>Privacy Mode limitations:</strong>
            </p>
            <ul>
              <li>Cloud AI providers may block Tor exit nodes</li>
              <li>Download speeds will be significantly slower</li>
              <li>Some OAuth flows may not work correctly</li>
            </ul>
            <p>
              Local AI models work identically in both modes.
            </p>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>Additional Security</h3>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={privacy.macSpoofing}
              onChange={(e) => onMacSpoofingChange(e.target.checked)}
            />
            <span>
              <strong>MAC Address Spoofing</strong>
              <br />
              <small>
                Randomize network hardware identifiers to prevent tracking
              </small>
            </span>
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={privacy.encryptPersistence}
              onChange={(e) => onEncryptPersistenceChange(e.target.checked)}
            />
            <span>
              <strong>Encrypt Persistent Storage</strong>
              <br />
              <small>
                Protect your data with LUKS encryption (recommended)
              </small>
            </span>
          </label>
        </div>

        {privacy.encryptPersistence && (
          <div className="form-group">
            <label htmlFor="persistence-passphrase">Encryption Passphrase</label>
            <input
              id="persistence-passphrase"
              type="password"
              value={privacy.persistencePassphrase || ''}
              onChange={(e) => onPersistencePassphraseChange(e.target.value)}
              placeholder="Enter a strong passphrase"
              className="installer-input"
            />
            <span className="form-hint">
              You'll need this passphrase every time you boot
            </span>
          </div>
        )}
      </div>

      <div className="installer-actions">
        <button
          type="button"
          onClick={onBack}
          className="installer-button secondary"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="installer-button primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
