/**
 * DiskSelection page - Choose target disk for installation
 */

import { useEffect } from 'react';
import type { DiskInfo, InstallationType } from '../backend/types';

interface DiskSelectionProps {
  installationType: InstallationType;
  targetDisk: DiskInfo | null;
  availableDisks: DiskInfo[];
  onTargetDiskChange: (disk: DiskInfo | null) => void;
  onRefreshDisks: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
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

function getDiskTypeIcon(type: DiskInfo['type']): string {
  switch (type) {
    case 'nvme':
      return '⚡';
    case 'sata':
      return '💾';
    case 'usb':
      return '🔌';
    case 'virtio':
      return '☁️';
    case 'scsi':
      return '🖥️';
    default:
      return '💿';
  }
}

function getSafetyBadge(safety: DiskInfo['safety']): { text: string; className: string } {
  switch (safety) {
    case 'safe-removable':
      return { text: 'Safe (Removable)', className: 'badge-safe' };
    case 'safe-virtual':
      return { text: 'Safe (Virtual)', className: 'badge-safe' };
    case 'blocked-system':
      return { text: 'System Disk', className: 'badge-danger' };
    case 'unknown':
    default:
      return { text: 'Caution', className: 'badge-warning' };
  }
}

export function DiskSelection({
  installationType,
  targetDisk,
  availableDisks,
  onTargetDiskChange,
  onRefreshDisks,
  onBack,
  onNext,
}: DiskSelectionProps) {
  // Refresh disks on mount
  useEffect(() => {
    onRefreshDisks();
  }, [onRefreshDisks]);

  // Skip disk selection for live session
  if (installationType === 'live-session') {
    return (
      <div className="installer-page disk-selection-page">
        <h2>Live Session</h2>
        <div className="live-session-info">
          <div className="live-icon">🚀</div>
          <p>
            You've chosen to run elizaOS in a live session. No installation is
            required.
          </p>
          <p className="warning">
            ⚠️ All data will be lost when you shut down. To save your work,
            consider installing to a disk.
          </p>
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

  const safeDisks = availableDisks.filter(
    (disk) => disk.safety !== 'blocked-system'
  );

  return (
    <div className="installer-page disk-selection-page">
      <h2>Select Target Disk</h2>
      <p className="page-description">
        Choose the disk where elizaOS will be installed.
        <strong className="warning-text">
          {' '}All data on the selected disk will be erased!
        </strong>
      </p>

      <div className="disk-actions">
        <button
          type="button"
          onClick={onRefreshDisks}
          className="installer-button secondary small"
        >
          🔄 Refresh Disks
        </button>
      </div>

      {safeDisks.length === 0 ? (
        <div className="no-disks-message">
          <p>No suitable disks found.</p>
          <p>
            Make sure you have a disk attached that is not currently being used
            as the system disk.
          </p>
        </div>
      ) : (
        <div className="disk-list">
          {safeDisks.map((disk) => {
            const safety = getSafetyBadge(disk.safety);
            const isSelected = targetDisk?.path === disk.path;

            return (
              <button
                key={disk.path}
                type="button"
                className={`disk-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onTargetDiskChange(disk)}
              >
                <div className="disk-icon">{getDiskTypeIcon(disk.type)}</div>
                <div className="disk-info">
                  <div className="disk-header">
                    <span className="disk-model">{disk.model}</span>
                    <span className={`disk-safety ${safety.className}`}>
                      {safety.text}
                    </span>
                  </div>
                  <div className="disk-details">
                    <span className="disk-path">{disk.path}</span>
                    <span className="disk-size">{formatSize(disk.size)}</span>
                    <span className="disk-type">{disk.type.toUpperCase()}</span>
                  </div>
                  {disk.partitions.length > 0 && (
                    <div className="disk-partitions">
                      {disk.partitions.length} partition(s)
                    </div>
                  )}
                </div>
                <div className="disk-radio">
                  <div
                    className={`radio-indicator ${isSelected ? 'checked' : ''}`}
                  />
                </div>
              </button>
            );
          })}
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
          onClick={onNext}
          disabled={!targetDisk}
          className="installer-button primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
