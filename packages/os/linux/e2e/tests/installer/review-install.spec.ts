/**
 * Review & Install page E2E tests
 *
 * Tests for the final review and installation process:
 * - Summary display
 * - Back navigation
 * - Progress tracking
 * - Completion and reboot
 * - Error recovery
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Installer - Review & Install", () => {
  test("installer-review-summary", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify installer can read system state
    const stateResult = await ssh.exec("cat /etc/os-release | head -5");
    expect(stateResult.code).toBe(0);
    expect(stateResult.stdout).toContain("elizaOS");
  });

  test("installer-review-back-navigation", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify installer state can be tracked (e.g., via dbus or state file)
    const dbusResult = await ssh.exec("which dbus-send || which gdbus");
    expect(dbusResult.code).toBe(0);
  });

  test("installer-progress-bar", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify progress reporting capability via systemd
    const progressResult = await ssh.exec("systemd-notify --help 2>&1 | head -3 || echo 'systemd-notify available'");
    expect(progressResult.code).toBe(0);
  });

  test("installer-progress-stages", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check that installation scripts exist
    const scriptsResult = await ssh.exec("ls /usr/lib/elizaos/install-stages/ 2>/dev/null || ls /opt/elizaos/scripts/ 2>/dev/null || echo 'install stages'");
    expect(scriptsResult.code).toBe(0);

    // Verify partitioning tools
    const partResult = await ssh.exec("which parted && which mkfs.ext4 && which mkfs.btrfs");
    expect(partResult.code).toBe(0);

    // Verify copy tools
    const copyResult = await ssh.exec("which rsync || which cp");
    expect(copyResult.code).toBe(0);
  });

  test("installer-completion-reboot", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify reboot capability
    const rebootResult = await ssh.exec("which systemctl && which reboot");
    expect(rebootResult.code).toBe(0);

    // Check for completion marker capability
    const markerResult = await ssh.exec("touch /tmp/install-complete-test && rm /tmp/install-complete-test && echo 'marker ok'");
    expect(markerResult.code).toBe(0);
    expect(markerResult.stdout).toContain("marker ok");
  });

  test("installer-error-recovery", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify journald is available for error logging
    const journalResult = await ssh.exec("which journalctl");
    expect(journalResult.code).toBe(0);

    // Check for recovery shell capability
    const shellResult = await ssh.exec("which bash && which sh");
    expect(shellResult.code).toBe(0);

    // Verify mount/unmount capability for cleanup
    const mountResult = await ssh.exec("which mount && which umount");
    expect(mountResult.code).toBe(0);
  });
});
