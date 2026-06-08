/**
 * InstallType page - Choose installation type
 */

import type { InstallationType } from '../backend/types';

interface InstallTypeProps {
  installationType: InstallationType;
  onInstallationTypeChange: (type: InstallationType) => void;
  onBack: () => void;
  onNext: () => void;
}

const INSTALL_OPTIONS: {
  value: InstallationType;
  title: string;
  description: string;
  icon: string;
  recommended?: boolean;
}[] = [
  {
    value: 'vm-disk',
    title: 'Install to Disk',
    description:
      'Full installation to a virtual machine disk or bare metal. Recommended for permanent use.',
    icon: '💿',
    recommended: true,
  },
  {
    value: 'usb-persistent',
    title: 'Persistent USB',
    description:
      'Install to USB drive with encrypted persistent storage. Take your AI everywhere.',
    icon: '🔐',
  },
  {
    value: 'live-session',
    title: 'Try Live',
    description:
      'Boot into a live session without installing. All data is lost on shutdown.',
    icon: '🚀',
  },
];

export function InstallType({
  installationType,
  onInstallationTypeChange,
  onBack,
  onNext,
}: InstallTypeProps) {
  return (
    <div className="installer-page install-type-page">
      <h2>Choose Installation Type</h2>
      <p className="page-description">
        Select how you want to run elizaOS on this machine.
      </p>

      <div className="install-type-options">
        {INSTALL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`install-type-card ${
              installationType === option.value ? 'selected' : ''
            }`}
            onClick={() => onInstallationTypeChange(option.value)}
          >
            <div className="install-type-icon">{option.icon}</div>
            <div className="install-type-content">
              <h3>
                {option.title}
                {option.recommended && (
                  <span className="recommended-badge">Recommended</span>
                )}
              </h3>
              <p>{option.description}</p>
            </div>
            <div className="install-type-radio">
              <div
                className={`radio-indicator ${
                  installationType === option.value ? 'checked' : ''
                }`}
              />
            </div>
          </button>
        ))}
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
