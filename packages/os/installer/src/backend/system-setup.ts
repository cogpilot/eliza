/**
 * System setup operations for elizaOS installer
 * Handles user creation, locale configuration, and system services
 */

import type { InstallConfig, UserConfig, PrivacyConfig, AgentConfig } from './types';

/** Run a command in the installed system chroot */
async function chrootExec(
  mountRoot: string,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['sudo', 'chroot', mountRoot, ...command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/** Run a command with sudo */
async function sudoExec(command: string[]): Promise<void> {
  const proc = Bun.spawn(['sudo', ...command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Command failed: ${command.join(' ')}\n${stderr}`);
  }
}

/** Configure system locale and timezone */
export async function configureLocale(
  mountRoot: string,
  locale: string,
  keyboard: string,
  timezone: string
): Promise<void> {
  // Set locale
  await sudoExec(['bash', '-c', `echo "LANG=${locale}.UTF-8" > ${mountRoot}/etc/locale.conf`]);
  await sudoExec(['bash', '-c', `echo "${locale}.UTF-8 UTF-8" >> ${mountRoot}/etc/locale.gen`]);
  await chrootExec(mountRoot, ['locale-gen']);

  // Set keyboard layout
  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/vconsole.conf << EOF
KEYMAP=${keyboard}
EOF`]);

  // Configure X11 keyboard
  await sudoExec(['mkdir', '-p', `${mountRoot}/etc/X11/xorg.conf.d`]);
  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/X11/xorg.conf.d/00-keyboard.conf << EOF
Section "InputClass"
    Identifier "system-keyboard"
    MatchIsKeyboard "on"
    Option "XkbLayout" "${keyboard}"
EndSection
EOF`]);

  // Set timezone
  await sudoExec(['ln', '-sf', `/usr/share/zoneinfo/${timezone}`, `${mountRoot}/etc/localtime`]);
  await chrootExec(mountRoot, ['hwclock', '--systohc']);
}

/** Set hostname */
export async function configureHostname(
  mountRoot: string,
  hostname: string
): Promise<void> {
  await sudoExec(['bash', '-c', `echo "${hostname}" > ${mountRoot}/etc/hostname`]);
  
  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/hosts << EOF
127.0.0.1   localhost
127.0.1.1   ${hostname}
::1         localhost ip6-localhost ip6-loopback
ff02::1     ip6-allnodes
ff02::2     ip6-allrouters
EOF`]);
}

/** Create user account */
export async function createUser(
  mountRoot: string,
  user: UserConfig
): Promise<void> {
  // Create user with home directory
  await chrootExec(mountRoot, [
    'useradd',
    '-m',
    '-G', 'sudo,audio,video,plugdev,netdev,docker',
    '-s', '/bin/bash',
    '-c', user.fullName,
    user.username,
  ]);

  // Set password using chpasswd
  const passwordInput = `${user.username}:${user.password}`;
  const proc = Bun.spawn(
    ['sudo', 'chroot', mountRoot, 'chpasswd'],
    {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  proc.stdin.write(passwordInput);
  proc.stdin.end();
  await proc.exited;

  // Add SSH key if provided
  if (user.sshPublicKey) {
    const sshDir = `${mountRoot}/home/${user.username}/.ssh`;
    await sudoExec(['mkdir', '-p', sshDir]);
    await sudoExec(['bash', '-c', `echo "${user.sshPublicKey}" > ${sshDir}/authorized_keys`]);
    await sudoExec(['chmod', '700', sshDir]);
    await sudoExec(['chmod', '600', `${sshDir}/authorized_keys`]);
    await chrootExec(mountRoot, ['chown', '-R', `${user.username}:${user.username}`, `/home/${user.username}/.ssh`]);
  }

  // Configure autologin if enabled
  if (user.autoLogin) {
    const gdmConfDir = `${mountRoot}/etc/gdm3`;
    await sudoExec(['mkdir', '-p', gdmConfDir]);
    await sudoExec(['bash', '-c', `cat > ${gdmConfDir}/custom.conf << EOF
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=${user.username}

[security]

[xdmcp]

[chooser]

[debug]
EOF`]);
  }

  // Configure passwordless sudo for the user
  await sudoExec(['bash', '-c', `echo "${user.username} ALL=(ALL) NOPASSWD:ALL" > ${mountRoot}/etc/sudoers.d/90-${user.username}`]);
  await sudoExec(['chmod', '440', `${mountRoot}/etc/sudoers.d/90-${user.username}`]);
}

/** Configure privacy settings */
export async function configurePrivacy(
  mountRoot: string,
  privacy: PrivacyConfig
): Promise<void> {
  // Create elizaOS config directory
  await sudoExec(['mkdir', '-p', `${mountRoot}/etc/elizaos`]);

  // Set privacy mode
  const privacyModeValue = privacy.mode === 'tor' ? '1' : '0';
  await sudoExec(['bash', '-c', `echo "${privacyModeValue}" > ${mountRoot}/etc/elizaos/privacy-mode`]);

  // Configure MAC spoofing
  if (privacy.macSpoofing) {
    await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/NetworkManager/conf.d/30-mac-randomization.conf << EOF
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=random
ethernet.cloned-mac-address=random
connection.stable-id=\${CONNECTION}/\${BOOT}
EOF`]);
  }

  // Enable Tor service if privacy mode is tor
  if (privacy.mode === 'tor') {
    await chrootExec(mountRoot, ['systemctl', 'enable', 'tor']);
  }
}

/** Configure elizaOS agent */
export async function configureAgent(
  mountRoot: string,
  agent: AgentConfig,
  username: string
): Promise<void> {
  const userHome = `/home/${username}`;
  const elizaConfigDir = `${mountRoot}${userHome}/.eliza`;

  // Create eliza config directory
  await sudoExec(['mkdir', '-p', elizaConfigDir]);

  // Write agent configuration
  const agentConfig = {
    displayName: agent.displayName,
    provider: {
      type: agent.providerType,
      ...(agent.apiKey && { apiKey: agent.apiKey }),
      ...(agent.localModelPath && { modelPath: agent.localModelPath }),
    },
    features: {
      voice: agent.enableVoice,
      telemetry: agent.enableTelemetry,
    },
    version: '1.0.0',
  };

  await sudoExec(['bash', '-c', `cat > ${elizaConfigDir}/config.json << 'EOF'
${JSON.stringify(agentConfig, null, 2)}
EOF`]);

  // Set ownership
  await chrootExec(mountRoot, ['chown', '-R', `${username}:${username}`, `${userHome}/.eliza`]);
}

/** Enable elizaOS systemd services */
export async function enableServices(mountRoot: string): Promise<void> {
  const services = [
    'elizaos-agent.service',
    'elizaos-launcher.service',
    'elizaos-first-boot.service',
    'NetworkManager.service',
    'gdm3.service',
  ];

  for (const service of services) {
    try {
      await chrootExec(mountRoot, ['systemctl', 'enable', service]);
    } catch {
      // Service may not exist, continue
    }
  }

  // Enable VM guest services if available
  const vmServices = [
    'qemu-guest-agent.service',
    'spice-vdagent.service',
    'open-vm-tools.service',
    'virtualbox-guest-utils.service',
  ];

  for (const service of vmServices) {
    try {
      await chrootExec(mountRoot, ['systemctl', 'enable', service]);
    } catch {
      // VM service not available, continue
    }
  }
}

/** Configure fstab for the installed system */
export async function configureFstab(
  mountRoot: string,
  diskPath: string,
  useUefi: boolean,
  useBtrfs: boolean,
  hasSwap: boolean
): Promise<void> {
  const partPrefix = diskPath.includes('nvme') ? 'p' : '';
  
  let fstab = '# /etc/fstab: static file system information.\n';
  fstab += '# <file system> <mount point> <type> <options> <dump> <pass>\n\n';

  if (useBtrfs) {
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) / btrfs subvol=@,compress=zstd,defaults 0 1\n`;
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /home btrfs subvol=@home,compress=zstd,defaults 0 2\n`;
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /var btrfs subvol=@var,compress=zstd,defaults 0 2\n`;
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /.snapshots btrfs subvol=@snapshots,compress=zstd,defaults 0 2\n`;
  } else {
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) / ext4 defaults 0 1\n`;
  }

  fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}2) /boot ext4 defaults 0 2\n`;

  if (useUefi) {
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}1) /boot/efi vfat umask=0077 0 2\n`;
  }

  if (hasSwap) {
    fstab += `UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}3) none swap sw 0 0\n`;
  }

  // Write fstab using a shell script to resolve UUIDs
  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/fstab << 'FSTAB_EOF'
# /etc/fstab: static file system information.
# <file system> <mount point> <type> <options> <dump> <pass>

FSTAB_EOF`]);

  // Append actual entries with resolved UUIDs
  if (useBtrfs) {
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) / btrfs subvol=@,compress=zstd,defaults 0 1" >> ${mountRoot}/etc/fstab`]);
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /home btrfs subvol=@home,compress=zstd,defaults 0 2" >> ${mountRoot}/etc/fstab`]);
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /var btrfs subvol=@var,compress=zstd,defaults 0 2" >> ${mountRoot}/etc/fstab`]);
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) /.snapshots btrfs subvol=@snapshots,compress=zstd,defaults 0 2" >> ${mountRoot}/etc/fstab`]);
  } else {
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}4) / ext4 defaults 0 1" >> ${mountRoot}/etc/fstab`]);
  }

  await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}2) /boot ext4 defaults 0 2" >> ${mountRoot}/etc/fstab`]);

  if (useUefi) {
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}1) /boot/efi vfat umask=0077 0 2" >> ${mountRoot}/etc/fstab`]);
  }

  if (hasSwap) {
    await sudoExec(['bash', '-c', `echo "UUID=$(blkid -s UUID -o value ${diskPath}${partPrefix}3) none swap sw 0 0" >> ${mountRoot}/etc/fstab`]);
  }
}

/** Full system setup orchestration */
export async function setupSystem(
  mountRoot: string,
  config: InstallConfig
): Promise<void> {
  if (!config.targetDisk) {
    throw new Error('No target disk selected');
  }

  // Configure locale and timezone
  await configureLocale(
    mountRoot,
    config.locale,
    config.keyboard,
    config.timezone
  );

  // Set hostname
  await configureHostname(mountRoot, config.user.hostname);

  // Create user account
  await createUser(mountRoot, config.user);

  // Configure privacy settings
  await configurePrivacy(mountRoot, config.privacy);

  // Configure elizaOS agent
  await configureAgent(mountRoot, config.agent, config.user.username);

  // Configure fstab
  await configureFstab(
    mountRoot,
    config.targetDisk.path,
    config.partitionScheme.useUefi,
    config.partitionScheme.useBtrfs,
    config.partitionScheme.swapSize > 0
  );

  // Enable services
  await enableServices(mountRoot);
}
