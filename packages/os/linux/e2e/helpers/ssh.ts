/**
 * SSH automation utilities for elizaOS E2E tests.
 *
 * Provides SSH connection management and command execution
 * inside the running VM.
 */

import { Client, type ConnectConfig, type ClientChannel } from "ssh2";

export interface SSHConfig {
  /** SSH host */
  host: string;
  /** SSH port */
  port: number;
  /** Username */
  username: string;
  /** Password (if using password auth) */
  password?: string;
  /** Private key path (if using key auth) */
  privateKeyPath?: string;
  /** Connection timeout in ms */
  timeout?: number;
}

export interface SSHConnection {
  /** Execute a command and return output */
  exec: (command: string, options?: ExecOptions) => Promise<ExecResult>;
  /** Upload a file to the VM */
  upload: (localPath: string, remotePath: string) => Promise<void>;
  /** Download a file from the VM */
  download: (remotePath: string, localPath: string) => Promise<void>;
  /** Check if a file exists */
  fileExists: (path: string) => Promise<boolean>;
  /** Read file contents */
  readFile: (path: string) => Promise<string>;
  /** Write file contents */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Close the connection */
  close: () => void;
  /** Check if connected */
  isConnected: () => boolean;
}

export interface ExecOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in ms */
  timeout?: number;
  /** Whether to run with sudo */
  sudo?: boolean;
}

export interface ExecResult {
  /** Exit code */
  code: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Combined output */
  output: string;
}

const DEFAULT_CONFIG: Partial<SSHConfig> = {
  host: "localhost",
  port: 2222,
  username: "eliza",
  timeout: 30000,
};

/**
 * Create an SSH connection to the VM.
 */
export async function createSSHConnection(partialConfig: Partial<SSHConfig> = {}): Promise<SSHConnection> {
  const config: SSHConfig = { ...DEFAULT_CONFIG, ...partialConfig } as SSHConfig;

  const client = new Client();

  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: config.timeout,
  };

  if (config.password) {
    connectConfig.password = config.password;
  }

  if (config.privateKeyPath) {
    const fs = await import("node:fs");
    connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
  }

  await new Promise<void>((resolve, reject) => {
    client.on("ready", resolve);
    client.on("error", reject);
    client.connect(connectConfig);
  });

  let connected = true;
  client.on("close", () => {
    connected = false;
  });

  const exec = async (command: string, options: ExecOptions = {}): Promise<ExecResult> => {
    let fullCommand = command;

    if (options.cwd) {
      fullCommand = `cd ${options.cwd} && ${command}`;
    }

    if (options.sudo) {
      fullCommand = `sudo ${fullCommand}`;
    }

    if (options.env) {
      const envPrefix = Object.entries(options.env)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ");
      fullCommand = `${envPrefix} ${fullCommand}`;
    }

    return new Promise((resolve, reject) => {
      client.exec(fullCommand, { pty: false }, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = "";
        let stderr = "";

        channel.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        channel.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        channel.on("close", (code: number) => {
          resolve({
            code,
            stdout,
            stderr,
            output: stdout + stderr,
          });
        });

        if (options.timeout) {
          setTimeout(() => {
            channel.close();
            reject(new Error(`Command timed out after ${options.timeout}ms`));
          }, options.timeout);
        }
      });
    });
  };

  const upload = async (localPath: string, remotePath: string): Promise<void> => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(localPath);

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on("close", () => {
          sftp.end();
          resolve();
        });
        writeStream.on("error", (err: Error) => {
          sftp.end();
          reject(err);
        });
        writeStream.end(content);
      });
    });
  };

  const download = async (remotePath: string, localPath: string): Promise<void> => {
    const fs = await import("node:fs");

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        const readStream = sftp.createReadStream(remotePath);
        const writeStream = fs.createWriteStream(localPath);

        readStream.pipe(writeStream);

        writeStream.on("close", () => {
          sftp.end();
          resolve();
        });

        readStream.on("error", (err: Error) => {
          sftp.end();
          reject(err);
        });
      });
    });
  };

  const fileExists = async (path: string): Promise<boolean> => {
    const result = await exec(`test -e ${path} && echo exists`);
    return result.stdout.includes("exists");
  };

  const readFile = async (path: string): Promise<string> => {
    const result = await exec(`cat ${path}`);
    if (result.code !== 0) {
      throw new Error(`Failed to read file: ${result.stderr}`);
    }
    return result.stdout;
  };

  const writeFile = async (path: string, content: string): Promise<void> => {
    // Use base64 to handle special characters
    const base64 = Buffer.from(content).toString("base64");
    const result = await exec(`echo '${base64}' | base64 -d > ${path}`);
    if (result.code !== 0) {
      throw new Error(`Failed to write file: ${result.stderr}`);
    }
  };

  return {
    exec,
    upload,
    download,
    fileExists,
    readFile,
    writeFile,
    close: () => client.end(),
    isConnected: () => connected,
  };
}

/**
 * Wait for SSH to become available and return a connection.
 */
export async function waitForSSHConnection(
  config: Partial<SSHConfig> = {},
  timeoutMs: number = 180000
): Promise<SSHConnection> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const conn = await createSSHConnection(config);
      return conn;
    } catch (err) {
      lastError = err as Error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error(`SSH connection timed out after ${timeoutMs}ms: ${lastError?.message}`);
}

/**
 * SSH command runner that retries on connection failure.
 */
export async function runSSHCommand(
  config: Partial<SSHConfig>,
  command: string,
  options: ExecOptions = {}
): Promise<ExecResult> {
  const conn = await createSSHConnection(config);
  try {
    return await conn.exec(command, options);
  } finally {
    conn.close();
  }
}
