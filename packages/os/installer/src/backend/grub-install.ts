/**
 * GRUB bootloader installation for elizaOS installer
 * Handles UEFI and legacy BIOS boot configuration
 */

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

/** Bind mount essential filesystems for chroot */
export async function bindMountForChroot(mountRoot: string): Promise<void> {
  const mounts = [
    ['--bind', '/dev', `${mountRoot}/dev`],
    ['--bind', '/dev/pts', `${mountRoot}/dev/pts`],
    ['--bind', '/proc', `${mountRoot}/proc`],
    ['--bind', '/sys', `${mountRoot}/sys`],
    ['--bind', '/run', `${mountRoot}/run`],
  ];

  for (const args of mounts) {
    await sudoExec(['mount', ...args]);
  }

  // Mount efivars if UEFI
  try {
    await sudoExec(['mount', '--bind', '/sys/firmware/efi/efivars', `${mountRoot}/sys/firmware/efi/efivars`]);
  } catch {
    // Not UEFI boot, continue
  }
}

/** Unmount bind mounts after chroot operations */
export async function unbindMountForChroot(mountRoot: string): Promise<void> {
  const mounts = [
    `${mountRoot}/sys/firmware/efi/efivars`,
    `${mountRoot}/run`,
    `${mountRoot}/sys`,
    `${mountRoot}/proc`,
    `${mountRoot}/dev/pts`,
    `${mountRoot}/dev`,
  ];

  for (const mount of mounts) {
    try {
      await sudoExec(['umount', '-l', mount]);
    } catch {
      // May not be mounted
    }
  }
}

/** Configure GRUB for elizaOS branding */
export async function configureGrubDefaults(mountRoot: string): Promise<void> {
  const grubDefaults = `# GRUB bootloader configuration for elizaOS
GRUB_DEFAULT=0
GRUB_TIMEOUT=5
GRUB_DISTRIBUTOR="elizaOS"
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"
GRUB_CMDLINE_LINUX=""

# Enable GRUB menu
GRUB_TIMEOUT_STYLE=menu

# Terminal output
GRUB_TERMINAL_OUTPUT="gfxterm"
GRUB_GFXMODE="1920x1080,1280x720,auto"
GRUB_GFXPAYLOAD_LINUX="keep"

# Theme (uses elizaOS GRUB theme if available)
GRUB_THEME="/boot/grub/themes/elizaos/theme.txt"

# Disable OS prober for cleaner boot menu
GRUB_DISABLE_OS_PROBER=true
`;

  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/default/grub << 'EOF'
${grubDefaults}
EOF`]);
}

/** Create elizaOS GRUB theme */
export async function installGrubTheme(mountRoot: string): Promise<void> {
  const themeDir = `${mountRoot}/boot/grub/themes/elizaos`;
  await sudoExec(['mkdir', '-p', themeDir]);

  // Create theme.txt
  const theme = `# elizaOS GRUB Theme
title-text: ""
desktop-color: "#050507"
desktop-image: "background.png"
terminal-font: "DejaVu Sans Mono Regular 12"
terminal-box: "terminal_box_*.png"

+ boot_menu {
    left = 30%
    top = 30%
    width = 40%
    height = 50%
    item_font = "DejaVu Sans Regular 14"
    item_color = "#F6F6F8"
    selected_item_color = "#FF5800"
    item_height = 30
    item_spacing = 10
    item_padding = 10
    icon_width = 24
    icon_height = 24
}

+ label {
    left = 50%-100
    top = 90%
    text = "elizaOS"
    font = "DejaVu Sans Bold 16"
    color = "#FF5800"
}

+ progress_bar {
    left = 30%
    top = 85%
    width = 40%
    height = 16
    fg_color = "#FF5800"
    bg_color = "#2A2D36"
    border_color = "#3A3D46"
}
`;

  await sudoExec(['bash', '-c', `cat > ${themeDir}/theme.txt << 'EOF'
${theme}
EOF`]);

  // Create a simple background (solid color PNG placeholder)
  // In production, this would be a proper branded image
  await sudoExec(['bash', '-c', `echo 'P6 1920 1080 255' | convert - -fill '#050507' -draw 'rectangle 0,0 1920,1080' ${themeDir}/background.png 2>/dev/null || true`]);
}

/** Install GRUB bootloader */
export async function installGrub(
  mountRoot: string,
  diskPath: string,
  useUefi: boolean
): Promise<void> {
  // Bind mount essential filesystems
  await bindMountForChroot(mountRoot);

  try {
    // Configure GRUB defaults
    await configureGrubDefaults(mountRoot);

    // Install GRUB theme
    await installGrubTheme(mountRoot);

    if (useUefi) {
      // Install GRUB for UEFI
      const result = await chrootExec(mountRoot, [
        'grub-install',
        '--target=x86_64-efi',
        '--efi-directory=/boot/efi',
        '--bootloader-id=elizaOS',
        '--recheck',
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`GRUB UEFI installation failed: ${result.stderr}`);
      }

      // Create fallback UEFI boot entry
      await sudoExec(['mkdir', '-p', `${mountRoot}/boot/efi/EFI/BOOT`]);
      await sudoExec(['cp', 
        `${mountRoot}/boot/efi/EFI/elizaOS/grubx64.efi`,
        `${mountRoot}/boot/efi/EFI/BOOT/BOOTX64.EFI`
      ]);
    } else {
      // Install GRUB for legacy BIOS
      const result = await chrootExec(mountRoot, [
        'grub-install',
        '--target=i386-pc',
        '--recheck',
        diskPath,
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`GRUB BIOS installation failed: ${result.stderr}`);
      }
    }

    // Generate GRUB configuration
    const mkconfig = await chrootExec(mountRoot, ['update-grub']);
    if (mkconfig.exitCode !== 0) {
      throw new Error(`GRUB config generation failed: ${mkconfig.stderr}`);
    }

    // Create custom GRUB entries for privacy mode
    await createPrivacyModeEntries(mountRoot);

  } finally {
    // Always unbind mounts
    await unbindMountForChroot(mountRoot);
  }
}

/** Create GRUB entries for privacy mode boot option */
async function createPrivacyModeEntries(mountRoot: string): Promise<void> {
  const customEntry = `#!/bin/sh
exec tail -n +3 $0
# Custom menu entries for elizaOS

menuentry "elizaOS" --class elizaos --class gnu-linux --class os {
    insmod gzio
    insmod part_gpt
    insmod btrfs
    search --no-floppy --fs-uuid --set=root UUID_PLACEHOLDER
    linux /boot/vmlinuz root=UUID=UUID_PLACEHOLDER ro quiet splash
    initrd /boot/initrd.img
}

menuentry "elizaOS — Privacy Mode" --class elizaos-privacy --class gnu-linux --class os {
    insmod gzio
    insmod part_gpt
    insmod btrfs
    search --no-floppy --fs-uuid --set=root UUID_PLACEHOLDER
    linux /boot/vmlinuz root=UUID=UUID_PLACEHOLDER ro quiet splash elizaos_privacy=1
    initrd /boot/initrd.img
}

menuentry "elizaOS (recovery mode)" --class elizaos-recovery --class gnu-linux --class os {
    insmod gzio
    insmod part_gpt
    insmod btrfs
    search --no-floppy --fs-uuid --set=root UUID_PLACEHOLDER
    linux /boot/vmlinuz root=UUID=UUID_PLACEHOLDER ro single
    initrd /boot/initrd.img
}
`;

  await sudoExec(['bash', '-c', `cat > ${mountRoot}/etc/grub.d/40_custom << 'EOF'
${customEntry}
EOF`]);

  await sudoExec(['chmod', '+x', `${mountRoot}/etc/grub.d/40_custom`]);
}

/** Verify GRUB installation */
export async function verifyGrubInstallation(
  mountRoot: string,
  useUefi: boolean
): Promise<boolean> {
  try {
    // Check GRUB config exists
    const configExists = await Bun.file(`${mountRoot}/boot/grub/grub.cfg`).exists();
    if (!configExists) {
      console.error('GRUB config not found');
      return false;
    }

    if (useUefi) {
      // Check EFI bootloader exists
      const efiExists = await Bun.file(`${mountRoot}/boot/efi/EFI/elizaOS/grubx64.efi`).exists();
      if (!efiExists) {
        console.error('UEFI bootloader not found');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('GRUB verification failed:', error);
    return false;
  }
}
