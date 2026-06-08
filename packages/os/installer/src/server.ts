/**
 * elizaOS Installer Backend Server
 * 
 * Provides API endpoints for disk operations, system setup, and installation.
 * Runs with elevated privileges to perform system modifications.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { spawn, SpawnOptions } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

import type { 
  InstallConfig, 
  DiskInfo, 
  InstallProgress 
} from './backend/types';
import { 
  getAvailableDisks, 
  partitionDisk, 
  formatPartitions, 
  mountPartitions 
} from './backend/disk-ops';
import { 
  createUser, 
  setLocale, 
  setTimezone, 
  enableServices 
} from './backend/system-setup';
import { installGrub } from './backend/grub-install';

const PORT = parseInt(process.env.ELIZAOS_INSTALLER_PORT || '3001', 10);
const LOG_FILE = '/var/log/elizaos-installer.log';

// Installation state
let currentProgress: InstallProgress = {
  step: 'idle',
  progress: 0,
  message: '',
  error: null,
};

// Logging
async function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  console.log(line.trim());
  
  try {
    await fs.appendFile(LOG_FILE, line);
  } catch {
    // Ignore log write errors
  }
}

// Execute shell command
function execCommand(cmd: string, args: string[], options: SpawnOptions = {}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: false, ...options });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    proc.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

// Update installation progress
function updateProgress(step: string, progress: number, message: string, error: string | null = null): void {
  currentProgress = { step, progress, message, error };
  log(`Progress: ${step} (${progress}%) - ${message}${error ? ` [ERROR: ${error}]` : ''}`);
}

// API Handlers
async function handleGetDisks(res: ServerResponse): Promise<void> {
  try {
    const disks = await getAvailableDisks();
    sendJSON(res, 200, { success: true, disks });
  } catch (err) {
    sendJSON(res, 500, { success: false, error: String(err) });
  }
}

async function handleGetProgress(res: ServerResponse): Promise<void> {
  sendJSON(res, 200, { success: true, progress: currentProgress });
}

async function handleStartInstall(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  
  try {
    const config: InstallConfig = JSON.parse(body);
    
    // Validate required fields
    if (!config.targetDisk || !config.user?.username) {
      sendJSON(res, 400, { success: false, error: 'Missing required fields' });
      return;
    }
    
    // Start installation in background
    performInstallation(config).catch((err) => {
      updateProgress('failed', 0, 'Installation failed', String(err));
    });
    
    sendJSON(res, 202, { success: true, message: 'Installation started' });
  } catch (err) {
    sendJSON(res, 400, { success: false, error: `Invalid request: ${err}` });
  }
}

// Main installation routine
async function performInstallation(config: InstallConfig): Promise<void> {
  const MOUNT_POINT = '/mnt/target';
  
  try {
    // Step 1: Partition disk
    updateProgress('partitioning', 5, `Partitioning ${config.targetDisk}...`);
    await partitionDisk(config.targetDisk);
    
    // Step 2: Format partitions
    updateProgress('formatting', 15, 'Formatting partitions...');
    await formatPartitions(config.targetDisk, config.privacy?.persistenceEncryption ?? false);
    
    // Step 3: Mount partitions
    updateProgress('mounting', 25, 'Mounting filesystems...');
    await fs.mkdir(MOUNT_POINT, { recursive: true });
    await mountPartitions(config.targetDisk, MOUNT_POINT);
    
    // Step 4: Copy root filesystem
    updateProgress('copying', 35, 'Copying system files...');
    await copyRootFS(MOUNT_POINT);
    
    // Step 5: Configure system
    updateProgress('configuring', 60, 'Configuring system...');
    
    // Set up chroot environment
    const chrootMounts = [
      ['mount', ['--bind', '/dev', `${MOUNT_POINT}/dev`]],
      ['mount', ['--bind', '/dev/pts', `${MOUNT_POINT}/dev/pts`]],
      ['mount', ['--bind', '/proc', `${MOUNT_POINT}/proc`]],
      ['mount', ['--bind', '/sys', `${MOUNT_POINT}/sys`]],
      ['mount', ['--bind', '/run', `${MOUNT_POINT}/run`]],
    ] as const;
    
    for (const [cmd, args] of chrootMounts) {
      await execCommand(cmd, args);
    }
    
    // Step 6: Create user
    updateProgress('user-setup', 70, `Creating user ${config.user.username}...`);
    await createUser(MOUNT_POINT, config.user);
    
    // Step 7: Set locale and timezone
    updateProgress('locale', 75, 'Setting locale and timezone...');
    await setLocale(MOUNT_POINT, config.locale.language, config.locale.keyboardLayout);
    await setTimezone(MOUNT_POINT, config.locale.timezone);
    
    // Step 8: Install bootloader
    updateProgress('bootloader', 80, 'Installing bootloader...');
    await installGrub(config.targetDisk, MOUNT_POINT, true);
    
    // Step 9: Configure services
    updateProgress('services', 85, 'Enabling services...');
    const services = ['elizaos-agent', 'elizaos-launcher', 'elizaos-first-boot'];
    if (config.privacy?.networkMode === 'tor') {
      services.push('tor');
    }
    await enableServices(MOUNT_POINT, services);
    
    // Step 10: Save installation answers for first-boot
    updateProgress('finalizing', 90, 'Saving configuration...');
    const answersPath = join(MOUNT_POINT, 'var/lib/elizaos/.install-answers.json');
    await fs.mkdir(join(MOUNT_POINT, 'var/lib/elizaos'), { recursive: true });
    await fs.writeFile(answersPath, JSON.stringify(config, null, 2));
    
    // Step 11: Configure privacy mode
    if (config.privacy?.networkMode === 'tor') {
      const privacyModePath = join(MOUNT_POINT, 'etc/elizaos/privacy-mode');
      await fs.mkdir(join(MOUNT_POINT, 'etc/elizaos'), { recursive: true });
      await fs.writeFile(privacyModePath, '1');
    }
    
    // Step 12: Unmount filesystems
    updateProgress('unmounting', 95, 'Unmounting filesystems...');
    
    // Unmount in reverse order
    for (const [, args] of [...chrootMounts].reverse()) {
      await execCommand('umount', [args[1]]);
    }
    await execCommand('umount', ['-R', MOUNT_POINT]);
    
    // Done!
    updateProgress('complete', 100, 'Installation complete! Please reboot.');
    
  } catch (err) {
    updateProgress('failed', currentProgress.progress, 'Installation failed', String(err));
    throw err;
  }
}

// Copy root filesystem from live environment
async function copyRootFS(mountPoint: string): Promise<void> {
  // Use rsync to copy the live filesystem
  const excludes = [
    '/dev/*',
    '/proc/*',
    '/sys/*',
    '/run/*',
    '/tmp/*',
    '/mnt/*',
    '/media/*',
    '/lost+found',
    '/var/tmp/*',
    '/var/cache/apt/archives/*.deb',
  ];
  
  const args = [
    '-aAXHx',
    '--info=progress2',
    ...excludes.flatMap(e => ['--exclude', e]),
    '/',
    `${mountPoint}/`,
  ];
  
  const result = await execCommand('rsync', args);
  
  if (result.code !== 0) {
    throw new Error(`rsync failed: ${result.stderr}`);
  }
}

// HTTP helpers
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

// Request router
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  log(`${method} ${path}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    switch (`${method} ${path}`) {
      case 'GET /api/health':
        sendJSON(res, 200, { status: 'ok', version: '1.0.0' });
        break;
        
      case 'GET /api/disks':
        await handleGetDisks(res);
        break;
        
      case 'GET /api/progress':
        await handleGetProgress(res);
        break;
        
      case 'POST /api/install':
        await handleStartInstall(req, res);
        break;
        
      case 'GET /api/locales':
        sendJSON(res, 200, {
          success: true,
          locales: [
            { code: 'en_US', name: 'English (US)' },
            { code: 'en_GB', name: 'English (UK)' },
            { code: 'de_DE', name: 'Deutsch' },
            { code: 'fr_FR', name: 'Français' },
            { code: 'es_ES', name: 'Español' },
            { code: 'pt_BR', name: 'Português (Brasil)' },
            { code: 'ja_JP', name: '日本語' },
            { code: 'zh_CN', name: '中文 (简体)' },
            { code: 'ko_KR', name: '한국어' },
          ],
        });
        break;
        
      case 'GET /api/timezones':
        const { stdout } = await execCommand('timedatectl', ['list-timezones']);
        const timezones = stdout.trim().split('\n').filter(Boolean);
        sendJSON(res, 200, { success: true, timezones });
        break;
        
      default:
        sendJSON(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    log(`Error handling ${method} ${path}: ${err}`, 'error');
    sendJSON(res, 500, { error: String(err) });
  }
}

// Start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  log(`elizaOS Installer Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});
