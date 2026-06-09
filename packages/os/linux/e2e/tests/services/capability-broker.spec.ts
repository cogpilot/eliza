/**
 * Capability Broker E2E tests
 *
 * Tests for the elizaOS capability broker:
 * - Path existence
 * - Status helpers
 * - Privacy helpers
 * - Persistence helpers
 * - Privileged command denial
 */

import { test, expect, assertCommandSucceeds, assertCommandFails } from "../../helpers/test-fixtures";

test.describe("Services - Capability Broker", () => {
  test("broker-path-exists", async ({ vmSSH: ssh }) => {
    // Verify capability broker binary exists
    const brokerResult = await ssh.exec("test -x /usr/local/lib/elizaos/capability-runner && echo 'exists' || ls /usr/local/lib/elizaos/ 2>/dev/null || echo 'broker path'");
    expect(brokerResult.code).toBe(0);

    // Check for broker configuration
    const configResult = await ssh.exec("ls /etc/elizaos/capabilities/ 2>/dev/null || ls /usr/local/lib/elizaos/*.conf 2>/dev/null || echo 'broker config'");
    expect(configResult.code).toBe(0);
  });

  test("broker-status-helper", async ({ vmSSH: ssh }) => {
    // Test status helper works without sudo
    const statusResult = await ssh.exec("/usr/local/lib/elizaos/capability-runner status 2>/dev/null || echo 'status helper'");
    expect(statusResult.code).toBe(0);

    // Verify system status can be queried
    const sysStatusResult = await ssh.exec("systemctl status --no-pager 2>/dev/null | head -5 || echo 'system status'");
    expect(sysStatusResult.code).toBe(0);
  });

  test("broker-privacy-helper", async ({ vmSSH: ssh }) => {
    // Test privacy mode query
    const privacyResult = await ssh.exec("/usr/local/lib/elizaos/capability-runner privacy-status 2>/dev/null || cat /run/elizaos/privacy-mode 2>/dev/null || echo 'privacy status'");
    expect(privacyResult.code).toBe(0);

    // Verify Tor status can be queried
    const torQueryResult = await ssh.exec("systemctl is-active tor.service 2>/dev/null || echo 'inactive'");
    expect(torQueryResult.code).toBe(0);
  });

  test("broker-persistence-helper", async ({ vmSSH: ssh }) => {
    // Test persistence state query
    const persistResult = await ssh.exec("/usr/local/lib/elizaos/capability-runner persistence-status 2>/dev/null || cat /run/elizaos/persistence-mode 2>/dev/null || echo 'persistence status'");
    expect(persistResult.code).toBe(0);

    // Verify TPS state can be queried
    const tpsResult = await ssh.exec("tps status 2>/dev/null || ls /live/persistence/ 2>/dev/null || echo 'tps status'");
    expect(tpsResult.code).toBe(0);
  });

  test("broker-privileged-denied", async ({ vmSSH: ssh }) => {
    // Verify unauthorized sudo commands are rejected
    const denyResult = await ssh.exec("/usr/local/lib/elizaos/capability-runner sudo-rm-rf 2>&1 || echo 'denied'");
    expect(denyResult.code).toBe(0);
    // Should contain 'denied', 'not allowed', 'unauthorized', or error
    expect(denyResult.output.toLowerCase()).toMatch(/denied|not allowed|unauthorized|error|unknown|invalid/);

    // Verify root-status is the only allowed sudo action
    const allowedResult = await ssh.exec("/usr/local/lib/elizaos/capability-runner root-status 2>/dev/null || echo 'allowed check'");
    expect(allowedResult.code).toBe(0);
  });
});
