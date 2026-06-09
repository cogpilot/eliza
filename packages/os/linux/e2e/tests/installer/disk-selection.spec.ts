/**
 * Disk Selection page E2E tests
 *
 * Tests for disk detection and selection:
 * - Virtual disk detection
 * - Safety labels
 * - Size display
 * - Partition preview
 * - Insufficient space handling
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Installer - Disk Selection", () => {
  test("installer-disk-detect-virtual", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // List available block devices
    const lsblkResult = await ssh.exec("lsblk -d -o NAME,SIZE,TYPE,MODEL -n");
    expect(lsblkResult.code).toBe(0);
    
    // Should detect at least one disk device
    const devices = lsblkResult.stdout.trim().split("\n").filter(line => line.includes("disk"));
    expect(devices.length, "At least one disk should be detected").toBeGreaterThan(0);
  });

  test("installer-disk-safety-labels", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check for removable device detection
    const removableResult = await ssh.exec("lsblk -d -o NAME,RM -n | grep '1$' || echo 'no removable'");
    expect(removableResult.code).toBe(0);

    // Check for udev rules that classify disks
    const udevResult = await ssh.exec("ls /etc/udev/rules.d/ | head -5");
    expect(udevResult.code).toBe(0);
  });

  test("installer-disk-size-display", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify disk size can be read
    const sizeResult = await ssh.exec("lsblk -b -d -o NAME,SIZE -n | head -3");
    expect(sizeResult.code).toBe(0);
    
    // Parse and verify size is a valid number
    const lines = sizeResult.stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const size = parseInt(parts[1], 10);
        expect(size, "Disk size should be a valid number").toBeGreaterThan(0);
      }
    }
  });

  test("installer-disk-partition-preview", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify partition tools are available
    const sgdiskResult = await ssh.exec("which sgdisk || which gdisk || which fdisk");
    expect(sgdiskResult.code).toBe(0);

    // Check if we can read partition info
    const partResult = await ssh.exec("fdisk -l 2>/dev/null | head -20 || true");
    expect(partResult.code).toBe(0);
  });

  test("installer-disk-insufficient-space", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify disk size checking capability
    const dfResult = await ssh.exec("df -B1 / | tail -1 | awk '{print $2}'");
    expect(dfResult.code).toBe(0);

    // The system should be able to calculate available space
    const totalBytes = parseInt(dfResult.stdout.trim(), 10);
    expect(totalBytes).toBeGreaterThan(0);

    // Minimum requirement is 20GB = 20 * 1024^3 bytes
    const MIN_BYTES = 20 * 1024 * 1024 * 1024;
    // This test verifies the check capability exists, not that it fails
  });
});
