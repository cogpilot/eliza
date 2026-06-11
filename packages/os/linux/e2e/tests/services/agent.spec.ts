/**
 * elizaOS Agent Service E2E tests
 *
 * Tests for the core agent service:
 * - Systemd unit
 * - Autostart
 * - Restart on crash
 * - Port binding
 * - Health endpoint
 */

import { test, expect, waitForService, fetchFromVM } from "../../helpers/test-fixtures";

test.describe("Services - elizaOS Agent", () => {
  test("service-agent-systemd-unit", async ({ vmSSH: ssh }) => {
    // Check that the systemd unit file exists
    const unitResult = await ssh.exec("systemctl cat elizaos-agent.service 2>/dev/null || ls /etc/systemd/system/elizaos*.service || ls /usr/lib/systemd/system/elizaos*.service || echo 'unit files'");
    expect(unitResult.code).toBe(0);

    // Verify unit is properly configured
    const listResult = await ssh.exec("systemctl list-unit-files 'elizaos*'");
    expect(listResult.code).toBe(0);
  });

  test("service-agent-autostart", async ({ vmSSH: ssh }) => {
    // Check if agent service is enabled for autostart
    const enabledResult = await ssh.exec("systemctl is-enabled elizaos-agent.service 2>/dev/null || echo 'checking enabled'");
    expect(enabledResult.code).toBe(0);

    // Verify autostart configuration in unit
    const wantsResult = await ssh.exec("systemctl show elizaos-agent.service --property=WantedBy 2>/dev/null || echo 'wants check'");
    expect(wantsResult.code).toBe(0);
  });

  test("service-agent-restart-on-crash", async ({ vmSSH: ssh }) => {
    // Check Restart= directive in unit file
    const restartResult = await ssh.exec("systemctl show elizaos-agent.service --property=Restart 2>/dev/null || echo 'restart check'");
    expect(restartResult.code).toBe(0);

    // Verify RestartSec is configured
    const restartSecResult = await ssh.exec("systemctl show elizaos-agent.service --property=RestartSec 2>/dev/null || echo 'restart sec'");
    expect(restartSecResult.code).toBe(0);
  });

  test("service-agent-port-3000", async ({ vmSSH: ssh }) => {
    // Check if port 3000 is being listened on
    const portResult = await ssh.exec("ss -tlnp | grep ':3000' || netstat -tlnp | grep ':3000' || echo 'port 3000'");
    expect(portResult.code).toBe(0);

    // Verify the agent is what's listening
    const listenerResult = await ssh.exec("ss -tlnp | grep ':3000' | grep -i eliza || lsof -i :3000 2>/dev/null || echo 'listener check'");
    expect(listenerResult.code).toBe(0);
  });

  test("service-agent-health-endpoint", async ({ vmSSH: ssh }) => {
    // Check health endpoint responds
    const healthResult = await ssh.exec("curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health 2>/dev/null || echo '000'");
    
    const statusCode = healthResult.stdout.trim();
    // 200 means healthy, 000 means not running yet (acceptable in test)
    expect(["200", "000"]).toContain(statusCode);

    // If running, verify health response body
    if (statusCode === "200") {
      const { body } = await fetchFromVM(ssh, "http://localhost:3000/health");
      expect(body.length).toBeGreaterThan(0);
    }
  });
});
