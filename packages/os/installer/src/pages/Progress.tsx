/**
 * Progress page - Installation progress and completion
 */

import type { InstallProgress } from '../backend/types';

interface ProgressProps {
  progress: InstallProgress | null;
  isInstalling: boolean;
  installError: string | null;
  onReboot: () => void;
  onRetry: () => void;
}

function OperationStatus({ 
  status 
}: { 
  status: 'pending' | 'running' | 'completed' | 'failed' 
}) {
  switch (status) {
    case 'completed':
      return <span className="status-icon completed">✓</span>;
    case 'running':
      return <span className="status-icon running">⟳</span>;
    case 'failed':
      return <span className="status-icon failed">✗</span>;
    case 'pending':
    default:
      return <span className="status-icon pending">○</span>;
  }
}

export function Progress({
  progress,
  isInstalling,
  installError,
  onReboot,
  onRetry,
}: ProgressProps) {
  const isComplete = progress?.overallPercent === 100;
  const hasFailed = installError || progress?.operations.some(op => op.status === 'failed');

  return (
    <div className="installer-page progress-page">
      {isComplete && !hasFailed ? (
        <>
          <div className="progress-complete">
            <div className="complete-icon">🎉</div>
            <h2>Installation Complete!</h2>
            <p>
              elizaOS has been successfully installed on your system. Remove the
              installation media and reboot to start using your new AI operating
              system.
            </p>
          </div>

          <div className="installer-actions">
            <button
              type="button"
              onClick={onReboot}
              className="installer-button primary"
            >
              Reboot Now
            </button>
          </div>
        </>
      ) : hasFailed ? (
        <>
          <div className="progress-failed">
            <div className="failed-icon">❌</div>
            <h2>Installation Failed</h2>
            <p>
              {installError || 'An error occurred during installation.'}
            </p>
          </div>

          {progress && (
            <div className="operation-list">
              {progress.operations.map((op, index) => (
                <div
                  key={index}
                  className={`operation-item ${op.status}`}
                >
                  <OperationStatus status={op.status} />
                  <span className="operation-name">{op.name}</span>
                  {op.error && (
                    <span className="operation-error">{op.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="installer-actions">
            <button
              type="button"
              onClick={onRetry}
              className="installer-button secondary"
            >
              Try Again
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Installing elizaOS</h2>
          <p className="progress-subtitle">
            {progress?.currentOperation || 'Preparing installation...'}
          </p>

          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progress?.overallPercent || 0}%` }}
            />
          </div>
          <div className="progress-percent">
            {progress?.overallPercent || 0}%
          </div>

          {progress && (
            <div className="operation-list">
              {progress.operations.map((op, index) => (
                <div
                  key={index}
                  className={`operation-item ${op.status}`}
                >
                  <OperationStatus status={op.status} />
                  <span className="operation-name">{op.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="progress-warning">
            <p>
              ⚠️ Do not turn off your computer or remove the installation media
              during this process.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
