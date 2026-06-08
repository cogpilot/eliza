/**
 * Installation state types for the elizaOS guided installer
 */

/** Supported locales for the installer */
export type Locale = 'en-US' | 'en-GB' | 'de-DE' | 'fr-FR' | 'es-ES' | 'ja-JP' | 'zh-CN';

/** Keyboard layout identifiers */
export type KeyboardLayout = 'us' | 'gb' | 'de' | 'fr' | 'es' | 'jp' | 'cn';

/** Installation target types */
export type InstallationType = 'vm-disk' | 'usb-persistent' | 'live-session';

/** Privacy mode options */
export type PrivacyMode = 'direct' | 'tor';

/** Disk partition information */
export interface DiskPartition {
  name: string;
  size: number;
  type: 'efi' | 'boot' | 'root' | 'swap' | 'home';
  filesystem: 'vfat' | 'ext4' | 'btrfs' | 'swap' | 'unknown';
  mountPoint: string;
}

/** Disk information from system enumeration */
export interface DiskInfo {
  path: string;
  model: string;
  serial: string;
  size: number;
  type: 'nvme' | 'sata' | 'usb' | 'virtio' | 'scsi';
  removable: boolean;
  partitions: DiskPartition[];
  safety: 'safe-removable' | 'safe-virtual' | 'blocked-system' | 'unknown';
}

/** User account configuration */
export interface UserConfig {
  username: string;
  fullName: string;
  password: string;
  hostname: string;
  sshPublicKey?: string;
  autoLogin: boolean;
}

/** Privacy and security settings */
export interface PrivacyConfig {
  mode: PrivacyMode;
  macSpoofing: boolean;
  encryptPersistence: boolean;
  persistencePassphrase?: string;
}

/** elizaOS agent configuration */
export interface AgentConfig {
  displayName: string;
  providerType: 'anthropic' | 'openai' | 'local' | 'none';
  apiKey?: string;
  localModelPath?: string;
  enableVoice: boolean;
  enableTelemetry: boolean;
}

/** Partitioning scheme for installation */
export interface PartitionScheme {
  type: 'gpt' | 'mbr';
  useUefi: boolean;
  useBtrfs: boolean;
  btrfsSubvolumes: string[];
  swapSize: number;
  homeSize: number | 'rest';
}

/** Complete installation configuration */
export interface InstallConfig {
  locale: Locale;
  keyboard: KeyboardLayout;
  timezone: string;
  installationType: InstallationType;
  targetDisk: DiskInfo | null;
  partitionScheme: PartitionScheme;
  user: UserConfig;
  privacy: PrivacyConfig;
  agent: AgentConfig;
}

/** Installation step identifiers */
export type InstallStep = 
  | 'welcome'
  | 'license'
  | 'install-type'
  | 'disk-selection'
  | 'user-setup'
  | 'privacy-mode'
  | 'agent-onboarding'
  | 'review'
  | 'progress';

/** Installation progress tracking */
export interface InstallProgress {
  currentStep: InstallStep;
  overallPercent: number;
  currentOperation: string;
  operations: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    error?: string;
  }[];
}

/** Default installation configuration */
export const defaultInstallConfig: InstallConfig = {
  locale: 'en-US',
  keyboard: 'us',
  timezone: 'UTC',
  installationType: 'vm-disk',
  targetDisk: null,
  partitionScheme: {
    type: 'gpt',
    useUefi: true,
    useBtrfs: true,
    btrfsSubvolumes: ['@', '@home', '@var', '@snapshots'],
    swapSize: 4096, // 4GB
    homeSize: 'rest',
  },
  user: {
    username: 'eliza',
    fullName: 'elizaOS User',
    password: '',
    hostname: 'elizaos',
    autoLogin: true,
  },
  privacy: {
    mode: 'direct',
    macSpoofing: true,
    encryptPersistence: true,
  },
  agent: {
    displayName: 'Eliza',
    providerType: 'none',
    enableVoice: false,
    enableTelemetry: false,
  },
};
