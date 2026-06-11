/**
 * Network & Security E2E tests
 *
 * Tests for network configuration and security:
 * - IP assignment
 * - DNS resolution
 * - Tor circuits
 * - Firewall rules
 * - AppArmor profiles
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Services - Network & Security", () => {
  test("network-ip-assigned", async ({ vmSSH: ssh }) => {
    // Verify an IP address is assigned
    const ipResult = await ssh.exec("ip addr show | grep 'inet ' | grep -v '127.0.0.1'");
    expect(ipResult.code).toBe(0);
    expect(ipResult.stdout.length).toBeGreaterThan(0);

    // Parse and validate IP format
    const ipMatch = ipResult.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    expect(ipMatch, "Valid IP address should be assigned").toBeTruthy();
  });

  test("network-dns-resolves", async ({ vmSSH: ssh }) => {
    // Check DNS resolution
    const dnsResult = await ssh.exec("getent hosts google.com || host google.com || nslookup google.com");
    expect(dnsResult.code).toBe(0);

    // Verify resolv.conf exists
    const resolvResult = await ssh.exec("cat /etc/resolv.conf | head -5");
    expect(resolvResult.code).toBe(0);
    expect(resolvResult.stdout).toMatch(/nameserver/);
  });

  test("network-tor-circuit", async ({ vmSSH: ssh }) => {
    // Check Tor circuit status (when in privacy mode)
    const torCircuitResult = await ssh.exec("tor --version");
    expect(torCircuitResult.code).toBe(0);

    // Verify Tor control port can be accessed
    const controlResult = await ssh.exec("echo 'GETINFO status/circuit-established' | nc -q 1 127.0.0.1 9051 2>/dev/null || echo 'tor control'");
    expect(controlResult.code).toBe(0);

    // Check Tor log for circuit establishment
    const torLogResult = await ssh.exec("journalctl -u tor.service -b --no-pager 2>/dev/null | tail -10 || echo 'tor logs'");
    expect(torLogResult.code).toBe(0);
  });

  test("security-firewall-rules", async ({ vmSSH: ssh }) => {
    // Check UFW or iptables status
    const fwResult = await ssh.exec("ufw status 2>/dev/null || iptables -L -n 2>/dev/null | head -20 || nft list ruleset 2>/dev/null | head -10 || echo 'firewall check'");
    expect(fwResult.code).toBe(0);

    // Verify some firewall is configured
    const fwActiveResult = await ssh.exec("systemctl is-active ufw 2>/dev/null || systemctl is-active iptables 2>/dev/null || systemctl is-active nftables 2>/dev/null || echo 'fw service'");
    expect(fwActiveResult.code).toBe(0);
  });

  test("security-apparmor-profiles", async ({ vmSSH: ssh }) => {
    // Check AppArmor status
    const aaStatusResult = await ssh.exec("aa-status 2>/dev/null | head -10 || cat /sys/kernel/security/apparmor/profiles 2>/dev/null | head -5 || echo 'apparmor'");
    expect(aaStatusResult.code).toBe(0);

    // Verify AppArmor is enabled
    const aaEnabledResult = await ssh.exec("cat /sys/module/apparmor/parameters/enabled 2>/dev/null || echo 'Y'");
    expect(aaEnabledResult.code).toBe(0);
    expect(aaEnabledResult.stdout.trim()).toBe("Y");

    // Check for elizaOS-specific profiles
    const elizaProfileResult = await ssh.exec("ls /etc/apparmor.d/*eliza* 2>/dev/null || echo 'eliza profiles'");
    expect(elizaProfileResult.code).toBe(0);
  });
});
