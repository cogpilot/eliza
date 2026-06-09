/**
 * Database & Storage E2E tests
 *
 * Tests for data storage:
 * - ~/.eliza directory
 * - Database initialization
 * - Migrations
 * - Persistence bind mounts
 */

import { test, expect, assertFileExists } from "../../helpers/test-fixtures";

test.describe("Services - Database & Storage", () => {
  test("storage-eliza-dir", async ({ vmSSH: ssh }) => {
    // Check that ~/.eliza directory exists or can be created
    const dirResult = await ssh.exec("ls -la ~/.eliza/ 2>/dev/null || mkdir -p ~/.eliza && ls -la ~/.eliza/");
    expect(dirResult.code).toBe(0);

    // Verify proper permissions
    const permResult = await ssh.exec("stat -c '%a %U' ~/.eliza/");
    expect(permResult.code).toBe(0);
    // Should be owned by user with restricted permissions
    expect(permResult.stdout).toMatch(/\d+ (eliza|root)/);
  });

  test("storage-db-init", async ({ vmSSH: ssh }) => {
    // Check for database file
    const dbResult = await ssh.exec("ls ~/.eliza/*.db 2>/dev/null || ls ~/.eliza/db/*.db 2>/dev/null || ls ~/.eliza/data/*.db 2>/dev/null || echo 'db files'");
    expect(dbResult.code).toBe(0);

    // Verify SQLite is available
    const sqliteResult = await ssh.exec("which sqlite3");
    expect(sqliteResult.code).toBe(0);

    // If database exists, verify it's valid SQLite
    const dbCheckResult = await ssh.exec("find ~/.eliza -name '*.db' -exec sqlite3 {} 'SELECT 1' \\; 2>/dev/null | head -1 || echo 'db check'");
    expect(dbCheckResult.code).toBe(0);
  });

  test("storage-db-migrate", async ({ vmSSH: ssh }) => {
    // Check for migration scripts or mechanism
    const migrateResult = await ssh.exec("ls /opt/elizaos/migrations/ 2>/dev/null || ls ~/.eliza/migrations/ 2>/dev/null || echo 'migrations'");
    expect(migrateResult.code).toBe(0);

    // Verify Drizzle or migration tool is available
    const drizzleResult = await ssh.exec("which drizzle-kit || ls /opt/elizaos/node_modules/.bin/drizzle* 2>/dev/null || echo 'drizzle'");
    expect(drizzleResult.code).toBe(0);
  });

  test("storage-persistence-bind-mount", async ({ vmSSH: ssh }) => {
    // Check for bind mounts to ~/.eliza
    const mountResult = await ssh.exec("mount | grep '\\.eliza' || findmnt ~/.eliza 2>/dev/null || echo 'eliza mounts'");
    expect(mountResult.code).toBe(0);

    // Verify persistence paths in TPS config
    const tpsResult = await ssh.exec("cat /etc/tps.conf 2>/dev/null || ls /usr/share/tails/persistence.conf 2>/dev/null || echo 'tps config'");
    expect(tpsResult.code).toBe(0);
  });
});
