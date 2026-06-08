/**
 * UserSetup page - Create user account and hostname
 */

import type { UserConfig } from '../backend/types';

interface UserSetupProps {
  user: UserConfig;
  onUsernameChange: (username: string) => void;
  onPasswordChange: (password: string) => void;
  onHostnameChange: (hostname: string) => void;
  onFullNameChange: (fullName: string) => void;
  onAutoLoginChange: (autoLogin: boolean) => void;
  onSshPublicKeyChange: (key: string) => void;
  errors: string[];
  onBack: () => void;
  onNext: () => void;
}

export function UserSetup({
  user,
  onUsernameChange,
  onPasswordChange,
  onHostnameChange,
  onFullNameChange,
  onAutoLoginChange,
  onSshPublicKeyChange,
  errors,
  onBack,
  onNext,
}: UserSetupProps) {
  return (
    <div className="installer-page user-setup-page">
      <h2>Create Your Account</h2>
      <p className="page-description">
        Set up your user account and system hostname.
      </p>

      {errors.length > 0 && (
        <div className="error-list">
          {errors.map((error, i) => (
            <div key={i} className="error-item">
              ⚠️ {error}
            </div>
          ))}
        </div>
      )}

      <div className="form-section">
        <h3>User Account</h3>

        <div className="form-group">
          <label htmlFor="fullname-input">Full Name</label>
          <input
            id="fullname-input"
            type="text"
            value={user.fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Your Name"
            className="installer-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="username-input">Username</label>
          <input
            id="username-input"
            type="text"
            value={user.username}
            onChange={(e) =>
              onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
            }
            placeholder="username"
            className="installer-input"
            autoComplete="username"
          />
          <span className="form-hint">
            Lowercase letters, numbers, hyphens, and underscores only
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="password-input">Password</label>
          <input
            id="password-input"
            type="password"
            value={user.password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            className="installer-input"
            autoComplete="new-password"
          />
          <span className="form-hint">
            At least 8 characters
          </span>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={user.autoLogin}
              onChange={(e) => onAutoLoginChange(e.target.checked)}
            />
            <span>Log in automatically</span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h3>System</h3>

        <div className="form-group">
          <label htmlFor="hostname-input">Hostname</label>
          <input
            id="hostname-input"
            type="text"
            value={user.hostname}
            onChange={(e) =>
              onHostnameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
            placeholder="elizaos"
            className="installer-input"
          />
          <span className="form-hint">
            Name for this machine on the network
          </span>
        </div>
      </div>

      <div className="form-section collapsible">
        <details>
          <summary>
            <h3>Advanced Options</h3>
          </summary>
          <div className="form-group">
            <label htmlFor="ssh-key-input">SSH Public Key (optional)</label>
            <textarea
              id="ssh-key-input"
              value={user.sshPublicKey || ''}
              onChange={(e) => onSshPublicKeyChange(e.target.value)}
              placeholder="ssh-rsa AAAA... user@host"
              className="installer-textarea"
              rows={3}
            />
            <span className="form-hint">
              Add an SSH key for passwordless remote access
            </span>
          </div>
        </details>
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
          disabled={errors.length > 0}
          className="installer-button primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
