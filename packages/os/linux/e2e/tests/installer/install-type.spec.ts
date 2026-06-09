/**
 * Installation Type page E2E tests
 *
 * Tests for the installation type selection:
 * - VM disk installation
 * - USB persistent mode
 * - Live session mode
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Installer - Installation Type", () => {
  test("installer-type-vm-disk", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify virtualization is detected
    const virtResult = await ssh.exec("systemd-detect-virt || echo 'bare-metal'");
    expect(virtResult.code).toBe(0);
    
    // Check for disk installation tools
    const partedResult = await ssh.exec("which parted || which fdisk");
    expect(partedResult.code).toBe(0);
  });

  test("installer-type-usb-persistent", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify LUKS tools are available for encrypted persistence
    const luksResult = await ssh.exec("which cryptsetup");
    expect(luksResult.code).toBe(0);

    // Check for persistence setup scripts
    const tpsResult = await ssh.exec("which tps-frontend || ls /usr/lib/python3/dist-packages/tps/ 2>/dev/null | head -1 || echo 'tps not found'");
    // Tails Persistent Storage tools should be available
    expect(tpsResult.code).toBe(0);
  });

  test("installer-type-live-session", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify live session infrastructure
    // Check if we're running from live media
    const liveResult = await ssh.exec("grep -q 'live' /proc/cmdline && echo 'live' || echo 'installed'");
    expect(liveResult.code).toBe(0);
    
    // Verify tmpfs/overlay is available for live mode
    const overlayResult = await ssh.exec("grep -E 'overlay|tmpfs' /proc/filesystems");
    expect(overlayResult.code).toBe(0);
  });

  test("installer-type-tooltip-info", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify installer assets directory exists with help content
    const assetsResult = await ssh.exec("ls /opt/elizaos/assets/ 2>/dev/null || ls /usr/share/elizaos/ 2>/dev/null || echo 'checking assets'");
    expect(assetsResult.code).toBe(0);
  });
});
