/**
 * VM Management utilities for elizaOS E2E tests.
 *
 * Provides QEMU lifecycle management, SSH connection handling,
 * and screenshot capture via VNC/SPICE.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";

export interface VMConfig {
  /** Path to VM image (.qcow2 or .iso) */
  imagePath: string;
  /** Memory allocation in MB */
  memoryMB: number;
  /** Number of CPU cores */
  cpuCores: number;
  /** SSH port forwarding (host port) */
  sshPort: number;
  /** API port forwarding (host port) */
  apiPort: number;
  /** VNC port (host port, 0 = auto) */
  vncPort: number;
  /** Enable KVM acceleration */
  enableKVM: boolean;
  /** Additional QEMU arguments */
  extraArgs?: string[];
  /** Boot mode: 'iso' for CD-ROM, 'disk' for direct boot */
  bootMode: "iso" | "disk";
  /** Additional disk for persistence testing */
  persistenceDisk?: string;
  /** Boot entry: 'normal' or 'privacy' */
  bootEntry?: "normal" | "privacy";
}

export interface VMHandle {
  /** QEMU process */
  process: ChildProcess;
  /** Configuration used to start the VM */
  config: VMConfig;
  /** Event emitter for VM lifecycle events */
  events: EventEmitter;
  /** PID of QEMU process */
  pid: number;
  /** Stop the VM */
  stop: () => Promise<void>;
  /** Wait for SSH to become available */
  waitForSSH: (timeoutMs?: number) => Promise<boolean>;
  /** Get VNC port */
  getVNCPort: () => number;
}

const DEFAULT_CONFIG: Partial<VMConfig> = {
  memoryMB: 4096,
  cpuCores: 2,
  sshPort: 2222,
  apiPort: 3000,
  vncPort: 0,
  enableKVM: true,
  bootMode: "disk",
  bootEntry: "normal",
};

/**
 * Find the latest VM image in the output directory.
 */
export function findLatestVMImage(outDir: string, format: "qcow2" | "iso" = "qcow2"): string | null {
  if (!fs.existsSync(outDir)) {
    return null;
  }

  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(`.${format}`));
  if (files.length === 0) {
    return null;
  }

  // Sort by modification time, newest first
  const sorted = files
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(outDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return path.join(outDir, sorted[0].name);
}

/**
 * Create a temporary disk for persistence testing.
 */
export async function createPersistenceDisk(sizeMB: number = 1024): Promise<string> {
  const tmpDir = process.env.TMPDIR || "/tmp";
  const diskPath = path.join(tmpDir, `elizaos-persistence-${Date.now()}.qcow2`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("qemu-img", ["create", "-f", "qcow2", diskPath, `${sizeMB}M`]);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`qemu-img create failed with code ${code}`));
    });
    proc.on("error", reject);
  });

  return diskPath;
}

/**
 * Start a QEMU VM with the given configuration.
 */
export async function startVM(partialConfig: Partial<VMConfig> & { imagePath: string }): Promise<VMHandle> {
  const config: VMConfig = { ...DEFAULT_CONFIG, ...partialConfig } as VMConfig;

  if (!fs.existsSync(config.imagePath)) {
    throw new Error(`VM image not found: ${config.imagePath}`);
  }

  const events = new EventEmitter();
  const vncPort = config.vncPort || 5900 + Math.floor(Math.random() * 100);

  const args = buildQEMUArgs(config, vncPort);

  const process = spawn("qemu-system-x86_64", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  process.stdout?.on("data", (data) => {
    stdout += data.toString();
    events.emit("stdout", data.toString());
  });

  process.stderr?.on("data", (data) => {
    stderr += data.toString();
    events.emit("stderr", data.toString());
  });

  process.on("exit", (code) => {
    events.emit("exit", { code, stdout, stderr });
  });

  process.on("error", (err) => {
    events.emit("error", err);
  });

  // Wait briefly to ensure QEMU started
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (process.exitCode !== null) {
    throw new Error(`QEMU failed to start: ${stderr}`);
  }

  const handle: VMHandle = {
    process,
    config,
    events,
    pid: process.pid!,
    stop: async () => {
      if (process.exitCode === null) {
        process.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            process.kill("SIGKILL");
            resolve();
          }, 10000);
          process.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    },
    waitForSSH: (timeoutMs = 180000) => waitForSSH(config.sshPort, timeoutMs),
    getVNCPort: () => vncPort,
  };

  return handle;
}

function buildQEMUArgs(config: VMConfig, vncPort: number): string[] {
  const args: string[] = [
    "-name",
    "elizaos-e2e",
    "-m",
    `${config.memoryMB}`,
    "-smp",
    `${config.cpuCores}`,
    "-nographic",
    "-serial",
    "mon:stdio",
  ];

  // KVM acceleration
  if (config.enableKVM) {
    args.push("-enable-kvm");
  }

  // Boot device
  if (config.bootMode === "iso") {
    args.push("-cdrom", config.imagePath);
    args.push("-boot", "d");
  } else {
    args.push("-drive", `file=${config.imagePath},format=qcow2,if=virtio`);
  }

  // Persistence disk
  if (config.persistenceDisk) {
    args.push("-drive", `file=${config.persistenceDisk},format=qcow2,if=virtio`);
  }

  // Network with port forwarding
  args.push(
    "-device",
    "virtio-net-pci,netdev=net0",
    "-netdev",
    `user,id=net0,hostfwd=tcp::${config.sshPort}-:22,hostfwd=tcp::${config.apiPort}-:3000`
  );

  // VNC display
  const vncDisplay = vncPort - 5900;
  args.push("-vnc", `:${vncDisplay}`);

  // Additional args
  if (config.extraArgs) {
    args.push(...config.extraArgs);
  }

  return args;
}

async function waitForSSH(port: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn("ssh", [
          "-o",
          "StrictHostKeyChecking=no",
          "-o",
          "UserKnownHostsFile=/dev/null",
          "-o",
          "ConnectTimeout=5",
          "-p",
          `${port}`,
          "localhost",
          "echo OK",
        ]);

        let stdout = "";
        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        proc.on("close", (code) => {
          resolve(code === 0 && stdout.includes("OK"));
        });

        proc.on("error", () => resolve(false));
      });

      if (result) {
        return true;
      }
    } catch {
      // Continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return false;
}

/**
 * Take a screenshot from VNC using vncsnapshot.
 */
export async function captureVNCScreenshot(vncPort: number, outputPath: string): Promise<void> {
  const vncDisplay = vncPort - 5900;
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("vncsnapshot", [`localhost:${vncDisplay}`, outputPath]);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`VNC screenshot capture failed with code ${code}`));
    });
    proc.on("error", reject);
  });
}
