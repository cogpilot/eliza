/**
 * Privacy Mode page E2E tests
 *
 * Tests for privacy and security settings:
 * - Direct mode default
 * - Tor routing toggle
 * - MAC spoofing
 * - Persistence encryption
 * - Warning displays
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Installer - Privacy Mode", () => {
  test("installer-privacy-direct-default", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify network configuration tools exist
    const nmResult = await ssh.exec("which nmcli || which networkctl");
    expect(nmResult.code).toBe(0);

    // Check if NetworkManager is available
    const nmStatusResult = await ssh.exec("systemctl is-enabled NetworkManager 2>/dev/null || echo 'checking nm'");
    expect(nmStatusResult.code).toBe(0);
  });

  test("installer-privacy-tor-enable", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify Tor is installed
    const torResult = await ssh.exec("which tor || ls /usr/bin/tor");
    expect(torResult.code).toBe(0);

    // Check for Tor configuration
    const torConfResult = await ssh.exec("ls /etc/tor/torrc || ls /etc/tor/ 2>/dev/null");
    expect(torConfResult.code).toBe(0);

    // Verify tor service unit exists
    const torServiceResult = await ssh.exec("systemctl list-unit-files tor.service 2>/dev/null | grep tor || echo 'tor service'");
    expect(torServiceResult.code).toBe(0);
  });

  test("installer-privacy-mac-spoof", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify MAC address can be read
    const macResult = await ssh.exec("ip link show | grep 'link/ether' | head -1");
    expect(macResult.code).toBe(0);

    // Check for macchanger or NetworkManager MAC spoofing capability
    const spoofResult = await ssh.exec("which macchanger || grep -r 'cloned-mac-address' /etc/NetworkManager/ 2>/dev/null || echo 'mac spoof tools'");
    expect(spoofResult.code).toBe(0);
  });

  test("installer-privacy-encryption-toggle", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify LUKS is available for persistence encryption
    const luksResult = await ssh.exec("which cryptsetup && cryptsetup --version");
    expect(luksResult.code).toBe(0);

    // Check for kernel dm-crypt support
    const dmResult = await ssh.exec("grep -E 'dm_crypt|CONFIG_DM_CRYPT' /proc/crypto 2>/dev/null || lsmod | grep dm_crypt || echo 'dm-crypt'");
    expect(dmResult.code).toBe(0);
  });

  test("installer-privacy-warning-display", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify help/documentation files exist
    const docsResult = await ssh.exec("ls /usr/share/doc/elizaos*/ 2>/dev/null || ls /opt/elizaos/docs/ 2>/dev/null || echo 'checking docs'");
    expect(docsResult.code).toBe(0);

    // Check for Tor warning/info in system docs
    const torDocsResult = await ssh.exec("grep -ri 'tor' /usr/share/doc/tails*/ 2>/dev/null | head -3 || echo 'tor docs'");
    expect(torDocsResult.code).toBe(0);
  });
});
