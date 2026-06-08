/**
 * Disk operations for elizaOS installer
 * Handles disk enumeration, partitioning, and formatting
 */

import type { DiskInfo, DiskPartition, PartitionScheme } from './types';

/** Error codes for disk operations */
export enum DiskOpError {
  ENUMERATION_FAILED = 'ENUMERATION_FAILED',
  DISK_NOT_FOUND = 'DISK_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DISK_IN_USE = 'DISK_IN_USE',
  PARTITIONING_FAILED = 'PARTITIONING_FAILED',
  FORMAT_FAILED = 'FORMAT_FAILED',
  MOUNT_FAILED = 'MOUNT_FAILED',
}

export class DiskOperationError extends Error {
  constructor(
    public code: DiskOpError,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'DiskOperationError';
  }
}

/** Parse lsblk JSON output into DiskInfo array */
function parseLsblkOutput(output: string): DiskInfo[] {
  const data = JSON.parse(output);
  const disks: DiskInfo[] = [];

  for (const device of data.blockdevices || []) {
    if (device.type !== 'disk') continue;

    const diskType = inferDiskType(device.name, device.tran);
    const safety = classifyDiskSafety(device, diskType);

    const partitions: DiskPartition[] = (device.children || []).map(
      (part: { name: string; size: number; fstype: string; mountpoint: string }) => ({
        name: part.name,
        size: part.size,
        type: inferPartitionType(part.fstype, part.mountpoint),
        filesystem: part.fstype || 'unknown',
        mountPoint: part.mountpoint || '',
      })
    );

    disks.push({
      path: `/dev/${device.name}`,
      model: device.model || 'Unknown',
      serial: device.serial || '',
      size: device.size,
      type: diskType,
      removable: device.rm === true || device.rm === '1',
      partitions,
      safety,
    });
  }

  return disks;
}

/** Infer disk type from device name and transport */
function inferDiskType(name: string, transport?: string): DiskInfo['type'] {
  if (name.startsWith('nvme')) return 'nvme';
  if (name.startsWith('vd')) return 'virtio';
  if (transport === 'usb') return 'usb';
  if (transport === 'sata' || transport === 'ata') return 'sata';
  return 'scsi';
}

/** Classify disk safety for installation */
function classifyDiskSafety(
  device: { rm?: boolean | string; mountpoint?: string; children?: { mountpoint?: string }[] },
  diskType: DiskInfo['type']
): DiskInfo['safety'] {
  // Check if any partition is mounted as root
  const hasRootMount = (device.children || []).some(
    (p: { mountpoint?: string }) => p.mountpoint === '/'
  );
  if (hasRootMount) return 'blocked-system';

  // Virtual disks in VMs are safe
  if (diskType === 'virtio') return 'safe-virtual';

  // Removable USB drives are safe
  if (device.rm === true || device.rm === '1') return 'safe-removable';

  return 'unknown';
}

/** Infer partition type from filesystem and mount point */
function inferPartitionType(
  fstype: string,
  mountpoint: string
): DiskPartition['type'] {
  if (fstype === 'vfat' && mountpoint?.includes('efi')) return 'efi';
  if (mountpoint === '/boot') return 'boot';
  if (mountpoint === '/') return 'root';
  if (fstype === 'swap') return 'swap';
  if (mountpoint === '/home') return 'home';
  return 'root';
}

/** Enumerate available disks on the system */
export async function listDisks(): Promise<DiskInfo[]> {
  const proc = Bun.spawn(['lsblk', '--json', '--bytes', '--output', 
    'NAME,SIZE,TYPE,MODEL,SERIAL,RM,TRAN,FSTYPE,MOUNTPOINT'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new DiskOperationError(
      DiskOpError.ENUMERATION_FAILED,
      'Failed to enumerate disks',
      stderr
    );
  }

  return parseLsblkOutput(output);
}

/** Generate partition commands for the given scheme */
function generatePartitionCommands(
  disk: string,
  scheme: PartitionScheme,
  diskSize: number
): string[] {
  const commands: string[] = [];
  const sgdisk = 'sgdisk';

  // Clear existing partition table
  commands.push(`${sgdisk} --zap-all ${disk}`);

  if (scheme.type === 'gpt') {
    let currentSector = 2048; // Start after GPT header
    const sectorSize = 512;

    // EFI System Partition (512MB)
    if (scheme.useUefi) {
      const efiSectors = (512 * 1024 * 1024) / sectorSize;
      commands.push(
        `${sgdisk} --new=1:${currentSector}:+${efiSectors} --typecode=1:EF00 --change-name=1:EFI ${disk}`
      );
      currentSector += efiSectors;
    }

    // Boot partition (1GB)
    const bootSectors = (1024 * 1024 * 1024) / sectorSize;
    commands.push(
      `${sgdisk} --new=2:${currentSector}:+${bootSectors} --typecode=2:8300 --change-name=2:boot ${disk}`
    );
    currentSector += bootSectors;

    // Swap partition
    if (scheme.swapSize > 0) {
      const swapSectors = (scheme.swapSize * 1024 * 1024) / sectorSize;
      commands.push(
        `${sgdisk} --new=3:${currentSector}:+${swapSectors} --typecode=3:8200 --change-name=3:swap ${disk}`
      );
      currentSector += swapSectors;
    }

    // Root partition (rest of disk)
    commands.push(
      `${sgdisk} --new=4:${currentSector}:0 --typecode=4:8300 --change-name=4:root ${disk}`
    );
  }

  return commands;
}

/** Partition a disk according to the given scheme */
export async function partitionDisk(
  disk: DiskInfo,
  scheme: PartitionScheme
): Promise<void> {
  // Safety check
  if (disk.safety === 'blocked-system') {
    throw new DiskOperationError(
      DiskOpError.PERMISSION_DENIED,
      'Cannot partition system disk',
      `Disk ${disk.path} contains mounted system partitions`
    );
  }

  const commands = generatePartitionCommands(disk.path, scheme, disk.size);

  for (const cmd of commands) {
    const parts = cmd.split(' ');
    const proc = Bun.spawn(['sudo', ...parts], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new DiskOperationError(
        DiskOpError.PARTITIONING_FAILED,
        `Partitioning failed: ${cmd}`,
        stderr
      );
    }
  }
}

/** Format partitions according to scheme */
export async function formatPartitions(
  disk: DiskInfo,
  scheme: PartitionScheme
): Promise<void> {
  const partPrefix = disk.path.includes('nvme') ? 'p' : '';

  // Format EFI partition
  if (scheme.useUefi) {
    await runCommand(['sudo', 'mkfs.vfat', '-F', '32', '-n', 'EFI', `${disk.path}${partPrefix}1`]);
  }

  // Format boot partition
  await runCommand(['sudo', 'mkfs.ext4', '-L', 'boot', `${disk.path}${partPrefix}2`]);

  // Format swap
  if (scheme.swapSize > 0) {
    await runCommand(['sudo', 'mkswap', '-L', 'swap', `${disk.path}${partPrefix}3`]);
  }

  // Format root partition
  const rootPart = `${disk.path}${partPrefix}4`;
  if (scheme.useBtrfs) {
    await runCommand(['sudo', 'mkfs.btrfs', '-f', '-L', 'root', rootPart]);

    // Create btrfs subvolumes
    const mountPoint = '/mnt/elizaos-install';
    await runCommand(['sudo', 'mkdir', '-p', mountPoint]);
    await runCommand(['sudo', 'mount', rootPart, mountPoint]);

    for (const subvol of scheme.btrfsSubvolumes) {
      await runCommand(['sudo', 'btrfs', 'subvolume', 'create', `${mountPoint}/${subvol}`]);
    }

    await runCommand(['sudo', 'umount', mountPoint]);
  } else {
    await runCommand(['sudo', 'mkfs.ext4', '-L', 'root', rootPart]);
  }
}

/** Helper to run a command with error handling */
async function runCommand(args: string[]): Promise<string> {
  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new DiskOperationError(
      DiskOpError.FORMAT_FAILED,
      `Command failed: ${args.join(' ')}`,
      stderr
    );
  }

  return output;
}

/** Mount partitions for installation */
export async function mountPartitions(
  disk: DiskInfo,
  scheme: PartitionScheme,
  mountRoot: string = '/mnt/elizaos-install'
): Promise<void> {
  const partPrefix = disk.path.includes('nvme') ? 'p' : '';

  await runCommand(['sudo', 'mkdir', '-p', mountRoot]);

  // Mount root partition
  const rootPart = `${disk.path}${partPrefix}4`;
  if (scheme.useBtrfs) {
    await runCommand([
      'sudo', 'mount', '-o', 'subvol=@,compress=zstd', rootPart, mountRoot
    ]);
    
    // Mount other subvolumes
    for (const [subvol, path] of [
      ['@home', '/home'],
      ['@var', '/var'],
      ['@snapshots', '/.snapshots'],
    ]) {
      if (scheme.btrfsSubvolumes.includes(subvol)) {
        await runCommand(['sudo', 'mkdir', '-p', `${mountRoot}${path}`]);
        await runCommand([
          'sudo', 'mount', '-o', `subvol=${subvol},compress=zstd`, rootPart, `${mountRoot}${path}`
        ]);
      }
    }
  } else {
    await runCommand(['sudo', 'mount', rootPart, mountRoot]);
  }

  // Mount boot partition
  await runCommand(['sudo', 'mkdir', '-p', `${mountRoot}/boot`]);
  await runCommand(['sudo', 'mount', `${disk.path}${partPrefix}2`, `${mountRoot}/boot`]);

  // Mount EFI partition
  if (scheme.useUefi) {
    await runCommand(['sudo', 'mkdir', '-p', `${mountRoot}/boot/efi`]);
    await runCommand(['sudo', 'mount', `${disk.path}${partPrefix}1`, `${mountRoot}/boot/efi`]);
  }

  // Enable swap
  if (scheme.swapSize > 0) {
    await runCommand(['sudo', 'swapon', `${disk.path}${partPrefix}3`]);
  }
}

/** Unmount partitions after installation */
export async function unmountPartitions(
  mountRoot: string = '/mnt/elizaos-install'
): Promise<void> {
  // Unmount in reverse order
  try {
    await runCommand(['sudo', 'swapoff', '-a']);
    await runCommand(['sudo', 'umount', '-R', mountRoot]);
  } catch {
    // Best effort unmount
  }
}
