import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for elizaOS VM ISO E2E tests.
 *
 * These tests run against a QEMU VM booted from the built ISO/qcow2 image.
 * Communication happens via SSH and VNC/SPICE for visual validation.
 */

const recording = !!process.env.E2E_RECORD;
const vmTimeout = parseInt(process.env.E2E_VM_TIMEOUT ?? "600000", 10);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // VM tests must run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single VM at a time
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: vmTimeout,
  expect: { timeout: 30_000 },
  use: {
    trace: recording ? "on" : "retain-on-failure",
    screenshot: recording ? "on" : "only-on-failure",
    video: recording ? "on" : "retain-on-failure",
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "vm-installer",
      testDir: "./tests/installer",
      testMatch: /.*\.spec\.ts$/,
    },
    {
      name: "vm-boot-modes",
      testDir: "./tests/boot-modes",
      testMatch: /.*\.spec\.ts$/,
    },
    {
      name: "vm-services",
      testDir: "./tests/services",
      testMatch: /.*\.spec\.ts$/,
    },
    {
      name: "vm-integration",
      testDir: "./tests/integration",
      testMatch: /.*\.spec\.ts$/,
    },
  ],
  outputDir: recording
    ? path.resolve(import.meta.dirname, "../../../../e2e-recordings/vm-e2e/test-results")
    : "./test-results",
});
