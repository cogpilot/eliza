/**
 * elizaOS Installer - Main Application
 */

import { useInstallState } from './hooks/useInstallState';
import {
  Welcome,
  License,
  InstallType,
  DiskSelection,
  UserSetup,
  PrivacyMode,
  AgentOnboarding,
  Review,
  Progress,
} from './pages';
import './styles.css';

/** Step indicator component */
function StepIndicator({
  currentStep,
  stepIndex,
}: {
  currentStep: string;
  stepIndex: number;
}) {
  const steps = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'license', label: 'License' },
    { key: 'install-type', label: 'Install Type' },
    { key: 'disk-selection', label: 'Disk' },
    { key: 'user-setup', label: 'User' },
    { key: 'privacy-mode', label: 'Privacy' },
    { key: 'agent-onboarding', label: 'Agent' },
    { key: 'review', label: 'Review' },
    { key: 'progress', label: 'Install' },
  ];

  return (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className={`step ${
            index < stepIndex
              ? 'completed'
              : index === stepIndex
              ? 'current'
              : 'pending'
          }`}
        >
          <div className="step-number">{index + 1}</div>
          <div className="step-label">{step.label}</div>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const state = useInstallState();

  const renderCurrentPage = () => {
    switch (state.currentStep) {
      case 'welcome':
        return (
          <Welcome
            locale={state.config.locale}
            keyboard={state.config.keyboard}
            onLocaleChange={state.setLocale}
            onKeyboardChange={state.setKeyboard}
            onNext={state.goNext}
          />
        );

      case 'license':
        return (
          <License
            onBack={state.goBack}
            onAccept={state.goNext}
          />
        );

      case 'install-type':
        return (
          <InstallType
            installationType={state.config.installationType}
            onInstallationTypeChange={state.setInstallationType}
            onBack={state.goBack}
            onNext={state.goNext}
          />
        );

      case 'disk-selection':
        return (
          <DiskSelection
            installationType={state.config.installationType}
            targetDisk={state.config.targetDisk}
            availableDisks={state.availableDisks}
            onTargetDiskChange={state.setTargetDisk}
            onRefreshDisks={state.refreshDisks}
            onBack={state.goBack}
            onNext={state.goNext}
          />
        );

      case 'user-setup':
        return (
          <UserSetup
            user={state.config.user}
            onUsernameChange={state.setUsername}
            onPasswordChange={state.setPassword}
            onHostnameChange={state.setHostname}
            onFullNameChange={state.setFullName}
            onAutoLoginChange={state.setAutoLogin}
            onSshPublicKeyChange={state.setSshPublicKey}
            errors={state.getStepErrors()}
            onBack={state.goBack}
            onNext={state.goNext}
          />
        );

      case 'privacy-mode':
        return (
          <PrivacyMode
            privacy={state.config.privacy}
            onPrivacyModeChange={state.setPrivacyMode}
            onMacSpoofingChange={state.setMacSpoofing}
            onEncryptPersistenceChange={state.setEncryptPersistence}
            onPersistencePassphraseChange={state.setPersistencePassphrase}
            onBack={state.goBack}
            onNext={state.goNext}
          />
        );

      case 'agent-onboarding':
        return (
          <AgentOnboarding
            agent={state.config.agent}
            onDisplayNameChange={state.setAgentDisplayName}
            onProviderTypeChange={state.setAgentProviderType}
            onApiKeyChange={state.setAgentApiKey}
            onEnableVoiceChange={state.setEnableVoice}
            onEnableTelemetryChange={state.setEnableTelemetry}
            onBack={state.goBack}
            onNext={state.goNext}
          />
        );

      case 'review':
        return (
          <Review
            config={state.config}
            onBack={state.goBack}
            onInstall={() => {
              state.goNext();
              state.startInstallation();
            }}
          />
        );

      case 'progress':
        return (
          <Progress
            progress={state.progress}
            isInstalling={state.isInstalling}
            installError={state.installError}
            onReboot={() => {
              // Trigger system reboot via API
              fetch('/api/reboot', { method: 'POST' }).catch(console.error);
            }}
            onRetry={() => {
              state.goToStep('review');
            }}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="installer-app">
      <header className="installer-header">
        <div className="installer-logo">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" fill="#FF5800" />
            <path
              d="M30 50 L45 65 L70 35"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span>elizaOS Installer</span>
        </div>
        <StepIndicator
          currentStep={state.currentStep}
          stepIndex={state.stepIndex}
        />
      </header>

      <main className="installer-main">
        {renderCurrentPage()}
      </main>

      <footer className="installer-footer">
        <span>elizaOS © 2024-2025</span>
        <span>•</span>
        <span>GPL-3.0 + Apache-2.0</span>
      </footer>
    </div>
  );
}

export default App;
