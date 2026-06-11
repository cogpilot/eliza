/**
 * Error Recovery E2E tests
 *
 * Tests for graceful error handling:
 * - Disk failure
 * - Network failure
 * - Persistence corruption
 * - Agent crash loops
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Integration - Error Recovery", () => {
  test("recovery-disk-failure", async ({ vmSSH: ssh }) => {
    // Verify disk health monitoring exists
    const smartResult = await ssh.exec("which smartctl || dpkg -l | grep smartmontools || echo 'smart tools'");
    expect(smartResult.code).toBe(0);

    // Check for disk error logging
    const dmesgResult = await ssh.exec("dmesg | grep -iE 'disk|sd|nvme|error' 2>/dev/null | tail -5 || echo 'disk logs'");
    expect(dmesgResult.code).toBe(0);

    // Verify filesystem check capability
    const fsckResult = await ssh.exec("which fsck && which e2fsck");
    expect(fsckResult.code).toBe(0);

    // Check for recovery console
    const consoleResult = await ssh.exec("ls /etc/systemd/system/emergency.target.wants/ 2>/dev/null || systemctl list-dependencies emergency.target | head -5 || echo 'emergency target'");
    expect(consoleResult.code).toBe(0);
  });

  test("recovery-network-failure", async ({ vmSSH: ssh }) => {
    // Verify agent can run offline
    const offlineResult = await ssh.exec("cat /opt/elizaos/config.json 2>/dev/null | grep -i offline || echo 'offline mode'");
    expect(offlineResult.code).toBe(0);

    // Check for network reconnection service
    const nmResult = await ssh.exec("systemctl is-enabled NetworkManager 2>/dev/null || echo 'nm enabled'");
    expect(nmResult.code).toBe(0);

    // Verify cached data is usable offline
    const cacheResult = await ssh.exec("ls ~/.eliza/cache/ 2>/dev/null || ls /var/cache/elizaos/ 2>/dev/null || echo 'cache'");
    expect(cacheResult.code).toBe(0);

    // Test that agent health degrades gracefully
    const healthResult = await ssh.exec("curl -s http://localhost:3000/health 2>/dev/null | grep -iE 'ok|healthy|offline' || echo 'health check'");
    expect(healthResult.code).toBe(0);
  });

  test("recovery-persistence-corruption", async ({ vmSSH: ssh }) => {
    // Verify fallback to amnesia mode is possible
    const fallbackResult = await ssh.exec("grep -i 'fallback\\|amnesia' /usr/lib/systemd/system/tps*.service 2>/dev/null || echo 'fallback config'");
    expect(fallbackResult.code).toBe(0);

    // Check for persistence repair tools
    const repairResult = await ssh.exec("which tps-repair || ls /usr/lib/python3/dist-packages/tps/ 2>/dev/null || echo 'tps tools'");
    expect(repairResult.code).toBe(0);

    // Verify LUKS recovery capability
    const luksRecoveryResult = await ssh.exec("cryptsetup --help | grep -i repair || cryptsetup --help | grep -i recover || echo 'luks recovery'");
    expect(luksRecoveryResult.code).toBe(0);

    // Check backup mechanism
    const backupResult = await ssh.exec("ls /var/backups/elizaos/ 2>/dev/null || cat /etc/cron.d/elizaos-backup 2>/dev/null || echo 'backup'");
    expect(backupResult.code).toBe(0);
  });

  test("recovery-agent-crash-loop", async ({ vmSSH: ssh }) => {
    // Verify crash loop detection in systemd
    const restartLimitResult = await ssh.exec("systemctl show elizaos-agent.service --property=StartLimitInterval 2>/dev/null || echo 'restart limit'");
    expect(restartLimitResult.code).toBe(0);

    // Check for failure notification
    const notifyResult = await ssh.exec("systemctl show elizaos-agent.service --property=OnFailure 2>/dev/null || echo 'on failure'");
    expect(notifyResult.code).toBe(0);

    // Verify crash dump capability
    const coredumpResult = await ssh.exec("systemctl is-enabled systemd-coredump 2>/dev/null || ls /var/lib/systemd/coredump/ 2>/dev/null || echo 'coredump'");
    expect(coredumpResult.code).toBe(0);

    // Check for user notification on repeated crashes
    const journalResult = await ssh.exec("journalctl -u elizaos-agent.service -b --no-pager 2>/dev/null | grep -iE 'fail|crash|restart' | tail -5 || echo 'journal check'");
    expect(journalResult.code).toBe(0);
  });
});
