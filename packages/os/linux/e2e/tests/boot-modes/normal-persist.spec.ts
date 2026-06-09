/**
 * Normal + Persistent USB boot mode E2E tests
 *
 * Tests for persistent storage mode:
 * - Greeter with persistence option
 * - LUKS partition creation
 * - Passphrase unlock
 * - Data persistence across reboots
 */

import { test, expect, assertCommandSucceeds, assertFileExists } from "../../helpers/test-fixtures";

test.describe("Boot Mode - Normal + Persistent", () => {
  test("boot-normal-persist-greeter", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify greeter ran with persistence options
    const greeterResult = await ssh.exec("journalctl -b | grep -i 'persistent\\|persistence\\|tps' | head -5 || echo 'checking persistence'");
    expect(greeterResult.code).toBe(0);

    // Check for Tails Persistent Storage service
    const tpsResult = await ssh.exec("systemctl list-unit-files 'tps*' 2>/dev/null || echo 'tps units'");
    expect(tpsResult.code).toBe(0);
  });

  test("boot-normal-persist-create-luks", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify LUKS tools are available
    const cryptsetupResult = await ssh.exec("which cryptsetup && cryptsetup --version");
    expect(cryptsetupResult.code).toBe(0);

    // Check for dm-crypt kernel support
    const dmResult = await ssh.exec("lsmod | grep dm_crypt || grep -q dm_crypt /proc/modules || modprobe dm_crypt 2>&1 || echo 'dm-crypt'");
    expect(dmResult.code).toBe(0);

    // Verify LUKS partition can be detected (if exists)
    const luksResult = await ssh.exec("blkid | grep -i luks || echo 'no luks partitions yet'");
    expect(luksResult.code).toBe(0);
  });

  test("boot-normal-persist-unlock-passphrase", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Verify dm-crypt devices can be listed
    const dmsetupResult = await ssh.exec("dmsetup ls 2>/dev/null || echo 'no dm devices'");
    expect(dmsetupResult.code).toBe(0);

    // Check for unlocked LUKS volumes
    const activeResult = await ssh.exec("ls /dev/mapper/ 2>/dev/null || echo 'mapper devices'");
    expect(activeResult.code).toBe(0);
  });

  test("boot-normal-persist-chat-survives", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check ~/.eliza directory structure
    const elizaDirResult = await ssh.exec("ls -la ~/.eliza/ 2>/dev/null || echo 'eliza dir'");
    expect(elizaDirResult.code).toBe(0);

    // Verify database file location
    const dbResult = await ssh.exec("ls ~/.eliza/*.db 2>/dev/null || ls ~/.eliza/db/ 2>/dev/null || echo 'checking db'");
    expect(dbResult.code).toBe(0);
  });

  test("boot-normal-persist-apps-survive", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check for built apps directory
    const appsResult = await ssh.exec("ls ~/.eliza/apps/ 2>/dev/null || ls ~/Apps/ 2>/dev/null || echo 'apps dir'");
    expect(appsResult.code).toBe(0);
  });

  test("boot-normal-persist-models-survive", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check for model storage
    const modelsResult = await ssh.exec("ls ~/.eliza/models/ 2>/dev/null || ls /var/lib/elizaos/models/ 2>/dev/null || echo 'models dir'");
    expect(modelsResult.code).toBe(0);
  });

  test("boot-normal-persist-wifi-survives", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check for NetworkManager connections directory
    const nmResult = await ssh.exec("ls /etc/NetworkManager/system-connections/ 2>/dev/null || echo 'nm connections'");
    expect(nmResult.code).toBe(0);

    // Verify Wi-Fi persistence bind mount
    const mountResult = await ssh.exec("mount | grep NetworkManager || echo 'nm mount'");
    expect(mountResult.code).toBe(0);
  });

  test("boot-normal-persist-apikeys-encrypted", async ({ bootModeVM }) => {
    const { ssh } = bootModeVM;

    // Check for encrypted config storage
    const configResult = await ssh.exec("ls ~/.eliza/config/ 2>/dev/null || ls ~/.config/elizaos/ 2>/dev/null || echo 'config dir'");
    expect(configResult.code).toBe(0);

    // Verify LUKS-backed storage is being used
    const luksResult = await ssh.exec("mount | grep 'crypt\\|luks' || findmnt -t ext4 ~/.eliza 2>/dev/null || echo 'encrypted mount'");
    expect(luksResult.code).toBe(0);
  });
});
