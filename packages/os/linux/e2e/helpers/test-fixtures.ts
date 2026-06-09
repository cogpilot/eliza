/**
 * Playwright test fixtures for elizaOS VM E2E tests.
 *
 * Provides VM lifecycle management as test fixtures.
 */

import { test as base, expect } from "@playwright/test";
import { startVM, findLatestVMImage, createPersistenceDisk, type VMHandle, type VMConfig } from "./vm-manager";
import { createSSHConnection, waitForSSHConnection, type SSHConnection } from "./ssh";
import * as path from "node:path";

/** Boot mode configuration */
export type BootMode = "normal-amnesia" | "normal-persist" | "privacy-amnesia" | "privacy-persist";

/** VM test context */
export interface VMContext {
  /** VM handle */
  vm: VMHandle;
  /** SSH connection to VM */
  ssh: SSHConnection;
  /** Boot mode */
  bootMode: BootMode;
  /** Configuration used */
  config: VMConfig;
}

/** Test fixtures */
export interface VMTestFixtures {
  /** VM context for installer tests */
  installerVM: VMContext;
  /** VM context for boot mode tests */
  bootModeVM: VMContext;
  /** SSH connection for service tests (reuses existing VM) */
  vmSSH: SSHConnection;
}

/** Worker fixtures (shared across tests in a worker) */
export interface VMWorkerFixtures {
  /** Shared VM for service tests */
  sharedVM: VMHandle;
}

/** Environment configuration */
export const ENV = {
  /** Path to output directory containing VM images */
  outDir: process.env.ELIZAOS_OUT_DIR || path.resolve(import.meta.dirname, "../../out"),
  /** SSH port */
  sshPort: parseInt(process.env.ELIZAOS_SSH_PORT || "2222", 10),
  /** API port */
  apiPort: parseInt(process.env.ELIZAOS_API_PORT || "3000", 10),
  /** SSH username */
  sshUser: process.env.ELIZAOS_SSH_USER || "eliza",
  /** SSH password */
  sshPassword: process.env.ELIZAOS_SSH_PASSWORD || "eliza",
  /** VM memory in MB */
  vmMemoryMB: parseInt(process.env.ELIZAOS_VM_MEMORY || "4096", 10),
  /** VM CPUs */
  vmCPUs: parseInt(process.env.ELIZAOS_VM_CPUS || "2", 10),
  /** Boot timeout in ms */
  bootTimeoutMs: parseInt(process.env.ELIZAOS_BOOT_TIMEOUT || "180000", 10),
  /** Enable KVM */
  enableKVM: process.env.ELIZAOS_ENABLE_KVM !== "0",
};

/**
 * Get boot mode from test file path or env.
 */
function getBootModeFromContext(testInfo: { file: string }): BootMode {
  const file = path.basename(testInfo.file);

  if (file.includes("normal-amnesia")) return "normal-amnesia";
  if (file.includes("normal-persist")) return "normal-persist";
  if (file.includes("privacy-amnesia")) return "privacy-amnesia";
  if (file.includes("privacy-persist")) return "privacy-persist";

  return (process.env.ELIZAOS_BOOT_MODE as BootMode) || "normal-amnesia";
}

/**
 * Build VM config for a boot mode.
 */
async function buildVMConfig(bootMode: BootMode, imageType: "iso" | "qcow2" = "qcow2"): Promise<VMConfig> {
  const imagePath = findLatestVMImage(ENV.outDir, imageType === "iso" ? "iso" : "qcow2");

  if (!imagePath) {
    throw new Error(`No ${imageType} image found in ${ENV.outDir}. Run 'just vm-build' first.`);
  }

  const config: VMConfig = {
    imagePath,
    memoryMB: ENV.vmMemoryMB,
    cpuCores: ENV.vmCPUs,
    sshPort: ENV.sshPort,
    apiPort: ENV.apiPort,
    vncPort: 0,
    enableKVM: ENV.enableKVM,
    bootMode: imageType === "iso" ? "iso" : "disk",
    bootEntry: bootMode.startsWith("privacy") ? "privacy" : "normal",
  };

  // Add persistence disk for persistent modes
  if (bootMode.includes("persist")) {
    config.persistenceDisk = await createPersistenceDisk(1024);
  }

  return config;
}

/**
 * Extended Playwright test with VM fixtures.
 */
export const test = base.extend<VMTestFixtures, VMWorkerFixtures>({
  // Worker-scoped shared VM
  sharedVM: [
    async ({}, use) => {
      const config = await buildVMConfig("normal-amnesia");
      const vm = await startVM(config);

      // Wait for boot
      const ready = await vm.waitForSSH(ENV.bootTimeoutMs);
      if (!ready) {
        await vm.stop();
        throw new Error("VM failed to boot - SSH not available");
      }

      await use(vm);
      await vm.stop();
    },
    { scope: "worker", timeout: 300_000 },
  ],

  // Per-test installer VM (fresh for each test)
  installerVM: async ({}, use, testInfo) => {
    const config = await buildVMConfig("normal-amnesia", "iso");
    const vm = await startVM(config);

    // Wait for installer to be ready
    await new Promise((resolve) => setTimeout(resolve, 30000));

    const ssh = await waitForSSHConnection({
      port: config.sshPort,
      username: ENV.sshUser,
      password: ENV.sshPassword,
    });

    await use({
      vm,
      ssh,
      bootMode: "normal-amnesia",
      config,
    });

    ssh.close();
    await vm.stop();
  },

  // Per-test boot mode VM
  bootModeVM: async ({}, use, testInfo) => {
    const bootMode = getBootModeFromContext(testInfo);
    const config = await buildVMConfig(bootMode);
    const vm = await startVM(config);

    const ready = await vm.waitForSSH(ENV.bootTimeoutMs);
    if (!ready) {
      await vm.stop();
      throw new Error(`VM failed to boot in ${bootMode} mode - SSH not available`);
    }

    const ssh = await waitForSSHConnection({
      port: config.sshPort,
      username: ENV.sshUser,
      password: ENV.sshPassword,
    });

    await use({
      vm,
      ssh,
      bootMode,
      config,
    });

    ssh.close();
    await vm.stop();
  },

  // SSH connection for service tests (uses shared VM)
  vmSSH: async ({ sharedVM }, use) => {
    const ssh = await waitForSSHConnection({
      port: sharedVM.config.sshPort,
      username: ENV.sshUser,
      password: ENV.sshPassword,
    });

    await use(ssh);
    ssh.close();
  },
});

export { expect };

/**
 * Test helper: assert command succeeds.
 */
export async function assertCommandSucceeds(ssh: SSHConnection, command: string, message?: string): Promise<string> {
  const result = await ssh.exec(command);
  expect(result.code, message || `Command failed: ${command}\n${result.stderr}`).toBe(0);
  return result.stdout;
}

/**
 * Test helper: assert command fails.
 */
export async function assertCommandFails(ssh: SSHConnection, command: string, message?: string): Promise<void> {
  const result = await ssh.exec(command);
  expect(result.code, message || `Command should have failed: ${command}`).not.toBe(0);
}

/**
 * Test helper: assert file exists.
 */
export async function assertFileExists(ssh: SSHConnection, path: string): Promise<void> {
  const exists = await ssh.fileExists(path);
  expect(exists, `File should exist: ${path}`).toBe(true);
}

/**
 * Test helper: assert file does not exist.
 */
export async function assertFileNotExists(ssh: SSHConnection, path: string): Promise<void> {
  const exists = await ssh.fileExists(path);
  expect(exists, `File should not exist: ${path}`).toBe(false);
}

/**
 * Test helper: wait for service to be active.
 */
export async function waitForService(ssh: SSHConnection, service: string, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await ssh.exec(`systemctl is-active ${service}`);
    if (result.stdout.trim() === "active") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Service ${service} did not become active within ${timeoutMs}ms`);
}

/**
 * Test helper: get HTTP response from endpoint.
 */
export async function fetchFromVM(ssh: SSHConnection, url: string): Promise<{ status: number; body: string }> {
  const result = await ssh.exec(`curl -s -w '\\n%{http_code}' '${url}'`);
  const lines = result.stdout.trim().split("\n");
  const status = parseInt(lines[lines.length - 1], 10);
  const body = lines.slice(0, -1).join("\n");
  return { status, body };
}
