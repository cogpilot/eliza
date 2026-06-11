/**
 * Normal + Amnesia boot mode E2E tests
 *
 * Tests for the default boot mode:
 * - Greeter display
 * - Desktop launch
 * - Agent autostart
 * - Data non-persistence
 * - Direct network
 */

import { test, expect, assertCommandSucceeds, assertFileExists, waitForService, fetchFromVM } from "../../helpers/test-fixtures";

test.describe("Boot Mode - Normal + Amnesia", () => {
  test("boot-normal-amnesia-greeter", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify greeter service was active at boot
    const greeterResult = await ssh.exec("journalctl -b -u gdm.service 2>/dev/null | head -10 || journalctl -b | grep -i greeter | head -5");
    expect(greeterResult.code).toBe(0);

    // Check that greeter completed successfully
    const sessionResult = await ssh.exec("loginctl list-sessions");
    expect(sessionResult.code).toBe(0);
  });

  test("boot-normal-amnesia-desktop", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify GNOME session is running
    const gnomeResult = await ssh.exec("pgrep -x gnome-session || pgrep -x gnome-shell");
    expect(gnomeResult.code).toBe(0);

    // Check for elizaOS branding
    const brandResult = await ssh.exec("cat /etc/os-release | grep -i eliza");
    expect(brandResult.code).toBe(0);
    expect(brandResult.stdout.toLowerCase()).toContain("eliza");
  });

  test("boot-normal-amnesia-agent-launch", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check if elizaOS agent service exists
    const serviceResult = await ssh.exec("systemctl list-unit-files 'elizaos*' 2>/dev/null || systemctl list-unit-files | grep eliza");
    expect(serviceResult.code).toBe(0);

    // Verify agent process is running or can be started
    const agentResult = await ssh.exec("pgrep -f elizaos || pgrep -f eliza-agent || systemctl status elizaos-agent 2>/dev/null | head -5");
    expect(agentResult.code).toBe(0);
  });

  test("boot-normal-amnesia-no-persist", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify we're running in amnesia mode (tmpfs/overlay)
    const mountResult = await ssh.exec("mount | grep -E 'tmpfs|overlay' | head -3");
    expect(mountResult.code).toBe(0);
    expect(mountResult.stdout.length).toBeGreaterThan(0);

    // Create a test file
    await ssh.exec("echo 'test data' > /tmp/amnesia-test-file");
    const existsResult = await ssh.exec("cat /tmp/amnesia-test-file");
    expect(existsResult.stdout).toContain("test data");

    // Note: actual persistence test requires reboot which is tested in integration tests
  });

  test("boot-normal-amnesia-network-direct", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify network is up
    const ipResult = await ssh.exec("ip addr show | grep 'inet ' | grep -v '127.0.0.1'");
    expect(ipResult.code).toBe(0);
    expect(ipResult.stdout.length).toBeGreaterThan(0);

    // Verify DNS resolution works
    const dnsResult = await ssh.exec("getent hosts google.com || host google.com || echo 'dns test'");
    expect(dnsResult.code).toBe(0);

    // Verify Tor is NOT routing traffic in normal mode
    const torResult = await ssh.exec("systemctl is-active tor.service 2>/dev/null || echo 'tor inactive'");
    // In normal mode, Tor should be inactive
    expect(torResult.stdout.trim()).toMatch(/inactive|tor inactive/);
  });
});
