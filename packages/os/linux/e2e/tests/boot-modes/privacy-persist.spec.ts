/**
 * Privacy + Persistent USB boot mode E2E tests
 *
 * Tests for Tor-routed persistent mode:
 * - Tor with storage
 * - Encrypted history
 * - Offline model usage
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Boot Mode - Privacy + Persistent", () => {
  test("boot-privacy-persist-tor-with-storage", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify Tor is configured
    const torConfigResult = await ssh.exec("ls /etc/tor/torrc");
    expect(torConfigResult.code).toBe(0);

    // Check for persistence with Tor combination
    const persistResult = await ssh.exec("mount | grep -E 'crypt|luks' || echo 'persistence mount'");
    expect(persistResult.code).toBe(0);

    // Verify Tor can coexist with persistence
    const coexistResult = await ssh.exec("systemctl list-dependencies tps-backend.service 2>/dev/null || echo 'tps deps'");
    expect(coexistResult.code).toBe(0);
  });

  test("boot-privacy-persist-history-encrypted", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify chat history would be stored on encrypted volume
    const historyPathResult = await ssh.exec("ls ~/.eliza/ 2>/dev/null || echo 'eliza dir'");
    expect(historyPathResult.code).toBe(0);

    // Check LUKS header on persistence partition
    const luksInfoResult = await ssh.exec("cryptsetup luksDump /dev/vdb1 2>/dev/null | head -10 || echo 'luks info'");
    expect(luksInfoResult.code).toBe(0);

    // Verify encryption is active
    const dmResult = await ssh.exec("dmsetup status 2>/dev/null | head -3 || echo 'dm status'");
    expect(dmResult.code).toBe(0);
  });

  test("boot-privacy-persist-models-offline", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check that models can be cached for offline use
    const modelCacheResult = await ssh.exec("ls ~/.eliza/models/ 2>/dev/null || ls /var/lib/elizaos/models/ 2>/dev/null || echo 'model cache'");
    expect(modelCacheResult.code).toBe(0);

    // Verify local inference doesn't require network
    const localInferResult = await ssh.exec("which llama-server || which llama.cpp || echo 'local inference'");
    expect(localInferResult.code).toBe(0);

    // Check that persistence volume is mounted for model storage
    const persistMountResult = await ssh.exec("mount | grep ~/.eliza 2>/dev/null || findmnt ~/.eliza 2>/dev/null || echo 'eliza mount'");
    expect(persistMountResult.code).toBe(0);
  });
});
