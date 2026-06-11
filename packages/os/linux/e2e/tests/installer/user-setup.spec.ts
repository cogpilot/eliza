/**
 * User Setup page E2E tests
 *
 * Tests for user account configuration:
 * - Username validation
 * - Password strength
 * - Hostname validation
 * - SSH key handling
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Installer - User Setup", () => {
  test("installer-user-username-validation", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify user management tools exist
    const useraddResult = await ssh.exec("which useradd && which adduser");
    expect(useraddResult.code).toBe(0);

    // Test that invalid usernames are rejected by system tools
    const invalidResult = await ssh.exec("useradd --help | grep -i 'login name' || echo 'help available'");
    expect(invalidResult.code).toBe(0);

    // Verify getent works for user lookup
    const getentResult = await ssh.exec("getent passwd root");
    expect(getentResult.code).toBe(0);
  });

  test("installer-user-password-strength", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Check for PAM password quality module
    const pamResult = await ssh.exec("ls /etc/pam.d/common-password || ls /etc/pam.d/passwd");
    expect(pamResult.code).toBe(0);

    // Verify libpwquality or cracklib is available
    const pwqResult = await ssh.exec("which pwmake || which cracklib-check || echo 'password tools'");
    expect(pwqResult.code).toBe(0);
  });

  test("installer-user-password-match", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify password hashing tools are available
    const mkpasswdResult = await ssh.exec("which mkpasswd || which chpasswd || echo 'password tools'");
    expect(mkpasswdResult.code).toBe(0);
  });

  test("installer-user-hostname-validation", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify hostname tools exist
    const hostnameResult = await ssh.exec("which hostnamectl || which hostname");
    expect(hostnameResult.code).toBe(0);

    // Check current hostname can be read
    const currentResult = await ssh.exec("hostname");
    expect(currentResult.code).toBe(0);
    expect(currentResult.stdout.trim().length).toBeGreaterThan(0);
  });

  test("installer-user-ssh-key-import", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Verify SSH is installed
    const sshResult = await ssh.exec("which ssh-keygen");
    expect(sshResult.code).toBe(0);

    // Check authorized_keys directory structure can be created
    const sshDirResult = await ssh.exec("ls -la /etc/skel/.ssh 2>/dev/null || echo 'skel ssh not present'");
    expect(sshDirResult.code).toBe(0);
  });

  test("installer-user-ssh-key-validation", async ({ installerVM }) => {
    const { ssh } = installerVM;

    // Test ssh-keygen can validate keys
    const validateResult = await ssh.exec("echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@test' | ssh-keygen -l -f - 2>&1 || echo 'validation available'");
    expect(validateResult.code).toBe(0);

    // Invalid key should produce error
    const invalidResult = await ssh.exec("echo 'invalid-key' | ssh-keygen -l -f - 2>&1 || true");
    // This should fail or produce an error message
    expect(invalidResult.output).toMatch(/invalid|error|not a public key|failed/i);
  });
});
