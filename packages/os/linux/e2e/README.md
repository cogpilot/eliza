# elizaOS VM ISO E2E Tests

End-to-end tests for the elizaOS VM ISO guided installation and boot modes.

## Overview

This test suite validates:
- **Guided Installation Wizard** (8 steps): Welcome, License, Install Type, Disk Selection, User Setup, Privacy Mode, Agent Onboarding, Review & Install
- **Boot Mode Matrix** (4 configurations): Normal+Amnesia, Normal+Persistent, Privacy+Amnesia, Privacy+Persistent
- **Service Tests**: Agent, Storage, Network/Security, Capability Broker
- **Integration Tests**: Full workflows, feature parity, error recovery

## Prerequisites

- **QEMU** with KVM support (`qemu-system-x86_64`)
- **Bun** (JavaScript runtime)
- **Built VM image** (run `just build` or `just vm-build` in the parent directory)

## Quick Start

```bash
# Install dependencies
bun install

# Run all tests
./run-suite.sh all

# Run specific test suite
./run-suite.sh installer
./run-suite.sh boot-modes
./run-suite.sh services
./run-suite.sh integration
```

## Test Structure

```
e2e/
├── fixtures/               # Answer files, test configs
│   ├── answer-file-default.json
│   ├── answer-file-persistence.json
│   └── answer-file-privacy.json
├── helpers/                # Test utilities
│   ├── vm-manager.ts       # QEMU lifecycle management
│   ├── ssh.ts              # SSH automation
│   └── test-fixtures.ts    # Playwright fixtures
├── tests/
│   ├── installer/          # Guided installation tests
│   │   ├── welcome.spec.ts
│   │   ├── license.spec.ts
│   │   ├── install-type.spec.ts
│   │   ├── disk-selection.spec.ts
│   │   ├── user-setup.spec.ts
│   │   ├── privacy-mode.spec.ts
│   │   ├── agent-onboarding.spec.ts
│   │   └── review-install.spec.ts
│   ├── boot-modes/         # Boot mode matrix tests
│   │   ├── normal-amnesia.spec.ts
│   │   ├── normal-persist.spec.ts
│   │   ├── privacy-amnesia.spec.ts
│   │   └── privacy-persist.spec.ts
│   ├── services/           # Service tests
│   │   ├── agent.spec.ts
│   │   ├── storage.spec.ts
│   │   ├── network-security.spec.ts
│   │   └── capability-broker.spec.ts
│   └── integration/        # Integration tests
│       ├── workflow.spec.ts
│       ├── feature-parity.spec.ts
│       └── error-recovery.spec.ts
├── playwright.config.ts    # Playwright configuration
├── run-suite.sh            # Test orchestration script
└── README.md
```

## Running Tests

### Using the Orchestration Script

```bash
# Run with defaults
./run-suite.sh

# Specify VM image
./run-suite.sh --qcow2 ./out/elizaos-vm.qcow2

# Customize resources
./run-suite.sh --memory 8192 --cpus 4 --timeout 900

# Enable recording
./run-suite.sh --record

# Disable KVM (slower but works without hardware virtualization)
./run-suite.sh --no-kvm
```

### Using Playwright Directly

```bash
# Run all tests
bun --bun playwright test

# Run specific project
bun --bun playwright test --project=vm-installer
bun --bun playwright test --project=vm-boot-modes
bun --bun playwright test --project=vm-services
bun --bun playwright test --project=vm-integration

# Run with UI
bun --bun playwright test --ui

# Run headed (visible browser)
bun --bun playwright test --headed
```

### Using Justfile

```bash
# From packages/os/linux/
just e2e              # Run all E2E tests
just e2e-installer    # Run installer tests
just e2e-boot-modes   # Run boot mode tests
just e2e-services     # Run service tests
just e2e-integration  # Run integration tests
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ELIZAOS_OUT_DIR` | `../out` | Directory containing VM images |
| `ELIZAOS_SSH_PORT` | `2222` | SSH port for VM connection |
| `ELIZAOS_API_PORT` | `3000` | Agent API port forwarding |
| `ELIZAOS_VM_MEMORY` | `4096` | VM memory in MB |
| `ELIZAOS_VM_CPUS` | `2` | VM CPU cores |
| `ELIZAOS_BOOT_TIMEOUT` | `180000` | VM boot timeout in ms |
| `ELIZAOS_ENABLE_KVM` | `1` | Enable KVM (`0` to disable) |
| `ELIZAOS_SSH_USER` | `eliza` | SSH username |
| `ELIZAOS_SSH_PASSWORD` | `eliza` | SSH password |
| `ELIZAOS_BOOT_MODE` | `normal-amnesia` | Default boot mode for tests |
| `E2E_RECORD` | `0` | Enable recording mode |
| `E2E_VM_TIMEOUT` | `600000` | Overall test timeout in ms |

## Test Fixtures

### VM Context

Tests receive a `VMContext` fixture with:
- `vm`: VM handle for lifecycle control
- `ssh`: SSH connection for command execution
- `bootMode`: Current boot mode configuration
- `config`: QEMU configuration used

### SSH Helpers

```typescript
// Execute command
const result = await ssh.exec("systemctl status elizaos-agent");

// Check file exists
const exists = await ssh.fileExists("/opt/elizaos/bin/launcher");

// Read file
const content = await ssh.readFile("/etc/os-release");

// Upload/download files
await ssh.upload("./local.txt", "/tmp/remote.txt");
await ssh.download("/tmp/remote.txt", "./local.txt");
```

### Test Assertions

```typescript
// Assert command succeeds
await assertCommandSucceeds(ssh, "which curl");

// Assert command fails
await assertCommandFails(ssh, "invalid-command");

// Assert file exists
await assertFileExists(ssh, "/opt/elizaos/bin/launcher");

// Wait for service
await waitForService(ssh, "elizaos-agent.service");

// Fetch from endpoint
const { status, body } = await fetchFromVM(ssh, "http://localhost:3000/health");
```

## Answer Files

For automated/unattended installation testing:

```json
{
  "installType": "vm-disk",
  "targetDisk": "/dev/vda",
  "locale": {
    "language": "en-US",
    "timezone": "America/New_York",
    "keyboardLayout": "us"
  },
  "user": {
    "username": "eliza",
    "password": "test-password-123",
    "hostname": "elizaos-test"
  },
  "privacy": {
    "networkMode": "direct",
    "macSpoof": false,
    "persistenceEncryption": false
  },
  "agent": {
    "providerType": "local",
    "enableVoice": false,
    "enableTelemetry": false
  }
}
```

## CI Integration

The test suite is designed for GitHub Actions:

```yaml
- name: Run VM E2E Tests
  run: |
    cd packages/os/linux/e2e
    ./run-suite.sh --no-kvm --timeout 900
  env:
    ELIZAOS_ENABLE_KVM: "0"
```

Artifacts are collected in `test-artifacts/` including:
- Playwright HTML report
- Test result JSON
- Screenshots on failure
- Video recordings (if enabled)

## Success Criteria

| Category | Threshold |
|----------|-----------|
| Installer wizard tests | 100% pass |
| Boot mode matrix (Normal) | 100% pass |
| Boot mode matrix (Privacy) | 90% pass (documented gaps) |
| Service tests | 100% pass |
| Integration tests | 95% pass |

## Troubleshooting

### VM Won't Boot
- Ensure KVM is available: `ls /dev/kvm`
- Try without KVM: `./run-suite.sh --no-kvm`
- Increase memory: `./run-suite.sh --memory 8192`

### SSH Connection Fails
- Increase boot timeout: `--timeout 300`
- Check VM console output in test logs
- Verify SSH is enabled in the image

### Tests Timeout
- Increase overall timeout: `E2E_VM_TIMEOUT=900000`
- Run smaller test suites individually
- Check VM resource allocation

## Development

Adding new tests:

1. Create spec file in appropriate directory
2. Use existing fixtures: `test`, `expect`, `vmSSH`, `installerVM`, `bootModeVM`
3. Follow naming convention: `category-feature.spec.ts`
4. Document in this README if adding new categories
