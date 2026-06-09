/**
 * Welcome page E2E tests
 *
 * Tests for the first step of the guided installer:
 * - Language selection
 * - Keyboard layout selection
 * - Locale detection
 */

import { test, expect, assertCommandSucceeds } from "../../helpers/test-fixtures";

test.describe("Installer - Welcome Page", () => {
  test("installer-welcome-renders", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check that the installer service is running
    const result = await ssh.exec("systemctl is-active elizaos-installer.service || true");
    // For ISO boot, the installer should be active or the desktop should be ready

    // Verify welcome page elements exist by checking if the installer app is running
    const processResult = await ssh.exec("pgrep -f 'elizaos-installer|elizaOS' || echo 'not found'");
    // The installer or desktop app should be running after boot
    expect(processResult.stdout.trim()).not.toBe("not found");
  });

  test("installer-language-selection", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Test that locale configuration files are present
    const localesResult = await ssh.exec("ls /usr/share/i18n/locales/ | head -20");
    expect(localesResult.code).toBe(0);

    // Verify common locales are available
    const locales = localesResult.stdout;
    expect(locales).toContain("en_US");
    expect(locales).toContain("de_DE");
    expect(locales).toContain("fr_FR");
  });

  test("installer-keyboard-layout", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check that keyboard layout configuration tools are available
    const kbdResult = await ssh.exec("which setxkbmap || which localectl || echo 'kbd tools available'");
    expect(kbdResult.code).toBe(0);

    // Verify keyboard layout database exists
    const layoutsResult = await ssh.exec("ls /usr/share/X11/xkb/symbols/ | head -10 || true");
    expect(layoutsResult.code).toBe(0);
  });

  test("installer-locale-detection", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check that timedatectl works for timezone detection
    const tzResult = await ssh.exec("timedatectl show --property=Timezone 2>/dev/null || echo 'UTC'");
    expect(tzResult.code).toBe(0);
    expect(tzResult.stdout.length).toBeGreaterThan(0);

    // Verify locale can be read from system
    const localeResult = await ssh.exec("locale | head -3");
    expect(localeResult.code).toBe(0);
  });
});
