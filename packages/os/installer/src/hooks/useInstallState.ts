/**
 * Installation state management hook for elizaOS installer
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  InstallConfig,
  InstallStep,
  InstallProgress,
  DiskInfo,
  Locale,
  KeyboardLayout,
  InstallationType,
  PrivacyMode,
} from '../backend/types';
import { defaultInstallConfig } from '../backend/types';

/** Installation steps in order */
const INSTALL_STEPS: InstallStep[] = [
  'welcome',
  'license',
  'install-type',
  'disk-selection',
  'user-setup',
  'privacy-mode',
  'agent-onboarding',
  'review',
  'progress',
];

/** Hook return type */
export interface UseInstallStateReturn {
  // Current state
  config: InstallConfig;
  currentStep: InstallStep;
  stepIndex: number;
  progress: InstallProgress | null;
  availableDisks: DiskInfo[];
  isInstalling: boolean;
  installError: string | null;

  // Navigation
  canGoBack: boolean;
  canGoNext: boolean;
  goBack: () => void;
  goNext: () => void;
  goToStep: (step: InstallStep) => void;

  // Configuration updates
  setLocale: (locale: Locale) => void;
  setKeyboard: (keyboard: KeyboardLayout) => void;
  setTimezone: (timezone: string) => void;
  setInstallationType: (type: InstallationType) => void;
  setTargetDisk: (disk: DiskInfo | null) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setHostname: (hostname: string) => void;
  setFullName: (fullName: string) => void;
  setAutoLogin: (autoLogin: boolean) => void;
  setSshPublicKey: (key: string) => void;
  setPrivacyMode: (mode: PrivacyMode) => void;
  setMacSpoofing: (enabled: boolean) => void;
  setEncryptPersistence: (enabled: boolean) => void;
  setPersistencePassphrase: (passphrase: string) => void;
  setAgentDisplayName: (name: string) => void;
  setAgentProviderType: (type: InstallConfig['agent']['providerType']) => void;
  setAgentApiKey: (key: string) => void;
  setEnableVoice: (enabled: boolean) => void;
  setEnableTelemetry: (enabled: boolean) => void;

  // Disk operations
  refreshDisks: () => Promise<void>;

  // Installation
  startInstallation: () => Promise<void>;
  cancelInstallation: () => void;

  // Validation
  validateCurrentStep: () => boolean;
  getStepErrors: () => string[];
}

export function useInstallState(): UseInstallStateReturn {
  const [config, setConfig] = useState<InstallConfig>(defaultInstallConfig);
  const [currentStep, setCurrentStep] = useState<InstallStep>('welcome');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [availableDisks, setAvailableDisks] = useState<DiskInfo[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const stepIndex = useMemo(
    () => INSTALL_STEPS.indexOf(currentStep),
    [currentStep]
  );

  const canGoBack = useMemo(
    () => stepIndex > 0 && !isInstalling,
    [stepIndex, isInstalling]
  );

  const canGoNext = useMemo(
    () => stepIndex < INSTALL_STEPS.length - 1 && !isInstalling,
    [stepIndex, isInstalling]
  );

  // Navigation
  const goBack = useCallback(() => {
    if (canGoBack) {
      setCurrentStep(INSTALL_STEPS[stepIndex - 1]);
    }
  }, [canGoBack, stepIndex]);

  const goNext = useCallback(() => {
    if (canGoNext) {
      setCurrentStep(INSTALL_STEPS[stepIndex + 1]);
    }
  }, [canGoNext, stepIndex]);

  const goToStep = useCallback((step: InstallStep) => {
    if (!isInstalling) {
      setCurrentStep(step);
    }
  }, [isInstalling]);

  // Configuration updates
  const setLocale = useCallback((locale: Locale) => {
    setConfig(prev => ({ ...prev, locale }));
  }, []);

  const setKeyboard = useCallback((keyboard: KeyboardLayout) => {
    setConfig(prev => ({ ...prev, keyboard }));
  }, []);

  const setTimezone = useCallback((timezone: string) => {
    setConfig(prev => ({ ...prev, timezone }));
  }, []);

  const setInstallationType = useCallback((installationType: InstallationType) => {
    setConfig(prev => ({ ...prev, installationType }));
  }, []);

  const setTargetDisk = useCallback((targetDisk: DiskInfo | null) => {
    setConfig(prev => ({ ...prev, targetDisk }));
  }, []);

  const setUsername = useCallback((username: string) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, username },
    }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, password },
    }));
  }, []);

  const setHostname = useCallback((hostname: string) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, hostname },
    }));
  }, []);

  const setFullName = useCallback((fullName: string) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, fullName },
    }));
  }, []);

  const setAutoLogin = useCallback((autoLogin: boolean) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, autoLogin },
    }));
  }, []);

  const setSshPublicKey = useCallback((sshPublicKey: string) => {
    setConfig(prev => ({
      ...prev,
      user: { ...prev.user, sshPublicKey },
    }));
  }, []);

  const setPrivacyMode = useCallback((mode: PrivacyMode) => {
    setConfig(prev => ({
      ...prev,
      privacy: { ...prev.privacy, mode },
    }));
  }, []);

  const setMacSpoofing = useCallback((macSpoofing: boolean) => {
    setConfig(prev => ({
      ...prev,
      privacy: { ...prev.privacy, macSpoofing },
    }));
  }, []);

  const setEncryptPersistence = useCallback((encryptPersistence: boolean) => {
    setConfig(prev => ({
      ...prev,
      privacy: { ...prev.privacy, encryptPersistence },
    }));
  }, []);

  const setPersistencePassphrase = useCallback((persistencePassphrase: string) => {
    setConfig(prev => ({
      ...prev,
      privacy: { ...prev.privacy, persistencePassphrase },
    }));
  }, []);

  const setAgentDisplayName = useCallback((displayName: string) => {
    setConfig(prev => ({
      ...prev,
      agent: { ...prev.agent, displayName },
    }));
  }, []);

  const setAgentProviderType = useCallback((providerType: InstallConfig['agent']['providerType']) => {
    setConfig(prev => ({
      ...prev,
      agent: { ...prev.agent, providerType },
    }));
  }, []);

  const setAgentApiKey = useCallback((apiKey: string) => {
    setConfig(prev => ({
      ...prev,
      agent: { ...prev.agent, apiKey },
    }));
  }, []);

  const setEnableVoice = useCallback((enableVoice: boolean) => {
    setConfig(prev => ({
      ...prev,
      agent: { ...prev.agent, enableVoice },
    }));
  }, []);

  const setEnableTelemetry = useCallback((enableTelemetry: boolean) => {
    setConfig(prev => ({
      ...prev,
      agent: { ...prev.agent, enableTelemetry },
    }));
  }, []);

  // Disk operations
  const refreshDisks = useCallback(async () => {
    try {
      const response = await fetch('/api/disks');
      if (!response.ok) {
        throw new Error('Failed to enumerate disks');
      }
      const disks = await response.json() as DiskInfo[];
      setAvailableDisks(disks);
    } catch (error) {
      console.error('Failed to refresh disks:', error);
      setAvailableDisks([]);
    }
  }, []);

  // Installation
  const startInstallation = useCallback(async () => {
    setIsInstalling(true);
    setInstallError(null);

    setProgress({
      currentStep: 'progress',
      overallPercent: 0,
      currentOperation: 'Preparing installation...',
      operations: [
        { name: 'Partition disk', status: 'pending' },
        { name: 'Format partitions', status: 'pending' },
        { name: 'Copy system files', status: 'pending' },
        { name: 'Configure system', status: 'pending' },
        { name: 'Install bootloader', status: 'pending' },
        { name: 'Finalize installation', status: 'pending' },
      ],
    });

    try {
      const response = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Installation failed');
      }

      // Monitor progress via SSE or polling
      // For now, simulate progress updates
      setProgress(prev => prev && {
        ...prev,
        overallPercent: 100,
        currentOperation: 'Installation complete!',
        operations: prev.operations.map(op => ({ ...op, status: 'completed' as const })),
      });

    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'Unknown error');
      setProgress(prev => prev && {
        ...prev,
        currentOperation: 'Installation failed',
        operations: prev.operations.map((op, i) => 
          op.status === 'running' 
            ? { ...op, status: 'failed' as const, error: 'Installation aborted' }
            : op
        ),
      });
    } finally {
      setIsInstalling(false);
    }
  }, [config]);

  const cancelInstallation = useCallback(() => {
    // Send cancel request to backend
    fetch('/api/install/cancel', { method: 'POST' }).catch(console.error);
    setIsInstalling(false);
  }, []);

  // Validation
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'license':
        return true;
      case 'install-type':
        return !!config.installationType;
      case 'disk-selection':
        return config.installationType === 'live-session' || !!config.targetDisk;
      case 'user-setup':
        return (
          config.user.username.length >= 3 &&
          config.user.password.length >= 8 &&
          config.user.hostname.length >= 1
        );
      case 'privacy-mode':
        return true;
      case 'agent-onboarding':
        return true;
      case 'review':
        return true;
      case 'progress':
        return !isInstalling;
      default:
        return true;
    }
  }, [currentStep, config, isInstalling]);

  const getStepErrors = useCallback((): string[] => {
    const errors: string[] = [];

    switch (currentStep) {
      case 'user-setup':
        if (config.user.username.length < 3) {
          errors.push('Username must be at least 3 characters');
        }
        if (config.user.password.length < 8) {
          errors.push('Password must be at least 8 characters');
        }
        if (config.user.hostname.length < 1) {
          errors.push('Hostname is required');
        }
        break;
      case 'disk-selection':
        if (config.installationType !== 'live-session' && !config.targetDisk) {
          errors.push('Please select a target disk');
        }
        break;
    }

    return errors;
  }, [currentStep, config]);

  return {
    config,
    currentStep,
    stepIndex,
    progress,
    availableDisks,
    isInstalling,
    installError,

    canGoBack,
    canGoNext,
    goBack,
    goNext,
    goToStep,

    setLocale,
    setKeyboard,
    setTimezone,
    setInstallationType,
    setTargetDisk,
    setUsername,
    setPassword,
    setHostname,
    setFullName,
    setAutoLogin,
    setSshPublicKey,
    setPrivacyMode,
    setMacSpoofing,
    setEncryptPersistence,
    setPersistencePassphrase,
    setAgentDisplayName,
    setAgentProviderType,
    setAgentApiKey,
    setEnableVoice,
    setEnableTelemetry,

    refreshDisks,
    startInstallation,
    cancelInstallation,
    validateCurrentStep,
    getStepErrors,
  };
}
