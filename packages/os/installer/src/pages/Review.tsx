/**
 * Review page - Final review before installation
 */

import type { InstallConfig, DiskInfo } from '../backend/types';

interface ReviewProps {
  config: InstallConfig;
  onBack: () => void;
  onInstall: () => void;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function DiskSummary({ disk }: { disk: DiskInfo | null }) {
  if (!disk) {
    return <span className="review-value">None (Live session)</span>;
  }

  return (
    <span className="review-value">
      {disk.model} ({formatSize(disk.size)})
      <br />
      <small>{disk.path}</small>
    </span>
  );
}

export function Review({ config, onBack, onInstall }: ReviewProps) {
  const isLiveSession = config.installationType === 'live-session';

  return (
    <div className="installer-page review-page">
      <h2>Review Your Settings</h2>
      <p className="page-description">
        Please review your configuration before proceeding.
        {!isLiveSession && (
          <strong className="warning-text">
            {' '}This will erase all data on the target disk!
          </strong>
        )}
      </p>

      <div className="review-sections">
        <div className="review-section">
          <h3>📍 Localization</h3>
          <div className="review-row">
            <span className="review-label">Language</span>
            <span className="review-value">{config.locale}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Keyboard</span>
            <span className="review-value">{config.keyboard}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Timezone</span>
            <span className="review-value">{config.timezone}</span>
          </div>
        </div>

        <div className="review-section">
          <h3>💿 Installation</h3>
          <div className="review-row">
            <span className="review-label">Type</span>
            <span className="review-value">
              {config.installationType === 'vm-disk' && 'Install to Disk'}
              {config.installationType === 'usb-persistent' && 'Persistent USB'}
              {config.installationType === 'live-session' && 'Live Session'}
            </span>
          </div>
          <div className="review-row">
            <span className="review-label">Target Disk</span>
            <DiskSummary disk={config.targetDisk} />
          </div>
          {!isLiveSession && (
            <>
              <div className="review-row">
                <span className="review-label">Filesystem</span>
                <span className="review-value">
                  {config.partitionScheme.useBtrfs ? 'Btrfs' : 'ext4'}
                </span>
              </div>
              <div className="review-row">
                <span className="review-label">Boot Mode</span>
                <span className="review-value">
                  {config.partitionScheme.useUefi ? 'UEFI' : 'Legacy BIOS'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="review-section">
          <h3>👤 User Account</h3>
          <div className="review-row">
            <span className="review-label">Full Name</span>
            <span className="review-value">{config.user.fullName}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Username</span>
            <span className="review-value">{config.user.username}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Hostname</span>
            <span className="review-value">{config.user.hostname}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Auto Login</span>
            <span className="review-value">
              {config.user.autoLogin ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="review-section">
          <h3>🔒 Privacy & Security</h3>
          <div className="review-row">
            <span className="review-label">Network Mode</span>
            <span className="review-value">
              {config.privacy.mode === 'tor' ? 'Privacy Mode (Tor)' : 'Direct'}
            </span>
          </div>
          <div className="review-row">
            <span className="review-label">MAC Spoofing</span>
            <span className="review-value">
              {config.privacy.macSpoofing ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {!isLiveSession && (
            <div className="review-row">
              <span className="review-label">Disk Encryption</span>
              <span className="review-value">
                {config.privacy.encryptPersistence ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
        </div>

        <div className="review-section">
          <h3>🤖 AI Agent</h3>
          <div className="review-row">
            <span className="review-label">Agent Name</span>
            <span className="review-value">{config.agent.displayName}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Provider</span>
            <span className="review-value">
              {config.agent.providerType === 'none' && 'Configure Later'}
              {config.agent.providerType === 'local' && 'Local AI'}
              {config.agent.providerType === 'anthropic' && 'Anthropic (Claude)'}
              {config.agent.providerType === 'openai' && 'OpenAI (GPT)'}
            </span>
          </div>
          <div className="review-row">
            <span className="review-label">Voice</span>
            <span className="review-value">
              {config.agent.enableVoice ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {!isLiveSession && (
        <div className="review-warning">
          <p>
            ⚠️ <strong>Final Warning:</strong> Clicking "Install" will erase all
            data on{' '}
            <code>{config.targetDisk?.path || 'the selected disk'}</code> and
            begin the installation process. This cannot be undone.
          </p>
        </div>
      )}

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
          onClick={onInstall}
          className="installer-button primary danger"
        >
          {isLiveSession ? 'Start Live Session' : 'Install elizaOS'}
        </button>
      </div>
    </div>
  );
}
