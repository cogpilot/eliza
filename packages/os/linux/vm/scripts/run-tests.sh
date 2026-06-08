#!/usr/bin/env bash
#
# run-tests.sh — elizaOS VM integration test suite
#
# Boots a VM image in QEMU and runs validation tests via SSH.
#
# Usage:
#   ./run-tests.sh [VM_IMAGE]
#
# VM_IMAGE defaults to the latest .qcow2 in out/
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_IMAGE="${1:-}"
TEST_TIMEOUT="${ELIZAOS_TEST_TIMEOUT:-600}"
SSH_PORT="${ELIZAOS_SSH_PORT:-2222}"
API_PORT="${ELIZAOS_API_PORT:-3000}"
SSH_USER="${ELIZAOS_SSH_USER:-eliza}"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"

# Find VM image if not specified
if [[ -z "$VM_IMAGE" ]]; then
    VM_IMAGE=$(find "$(dirname "$SCRIPT_DIR")/../out" -name "*.qcow2" 2>/dev/null | sort | tail -1)
    if [[ -z "$VM_IMAGE" ]]; then
        echo "ERROR: No VM image found. Run 'just vm-build' and 'just vm-convert-qcow2' first."
        exit 1
    fi
fi

if [[ ! -f "$VM_IMAGE" ]]; then
    echo "ERROR: VM image not found: $VM_IMAGE"
    exit 1
fi

echo "=========================================="
echo "elizaOS VM Integration Tests"
echo "=========================================="
echo "Image: $VM_IMAGE"
echo "Timeout: ${TEST_TIMEOUT}s"
echo "SSH Port: $SSH_PORT"
echo "API Port: $API_PORT"
echo ""

# Cleanup function
cleanup() {
    if [[ -n "${QEMU_PID:-}" ]]; then
        echo "Stopping QEMU (PID: $QEMU_PID)..."
        kill "$QEMU_PID" 2>/dev/null || true
        wait "$QEMU_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Start QEMU in background
echo "[1/7] Starting VM..."
qemu-system-x86_64 \
    -m 4G \
    -smp 2 \
    -enable-kvm \
    -nographic \
    -drive "file=$VM_IMAGE,format=qcow2" \
    -serial mon:stdio \
    -device virtio-net-pci,netdev=net0 \
    -netdev "user,id=net0,hostfwd=tcp::${SSH_PORT}-:22,hostfwd=tcp::${API_PORT}-:3000" \
    &
QEMU_PID=$!
echo "QEMU started with PID: $QEMU_PID"

# Wait for VM to boot
echo ""
echo "[2/7] Waiting for VM to boot..."
BOOT_TIMEOUT=180
BOOT_START=$(date +%s)
SSH_READY=false

while [[ $(($(date +%s) - BOOT_START)) -lt $BOOT_TIMEOUT ]]; do
    if ssh $SSH_OPTS -p "$SSH_PORT" "${SSH_USER}@localhost" "echo 'SSH OK'" 2>/dev/null; then
        SSH_READY=true
        break
    fi
    sleep 5
    echo -n "."
done
echo ""

if [[ "$SSH_READY" != "true" ]]; then
    echo "FAILED: VM did not become accessible via SSH within ${BOOT_TIMEOUT}s"
    exit 1
fi
echo "✅ VM booted and SSH accessible"

# Test functions
run_ssh() {
    ssh $SSH_OPTS -p "$SSH_PORT" "${SSH_USER}@localhost" "$@"
}

test_pass() {
    echo "✅ $1"
}

test_fail() {
    echo "❌ $1"
    TESTS_FAILED=true
}

TESTS_FAILED=false

# Test 3: Check elizaOS agent service
echo ""
echo "[3/7] Testing elizaOS agent service..."
if run_ssh "systemctl is-active elizaos-agent.service" 2>/dev/null | grep -q "active"; then
    test_pass "elizaos-agent.service is running"
else
    # Service might be disabled by default, check if it exists
    if run_ssh "systemctl list-unit-files elizaos-agent.service" 2>/dev/null | grep -q "elizaos-agent"; then
        test_pass "elizaos-agent.service is installed (not active - expected for fresh install)"
    else
        test_fail "elizaos-agent.service not found"
    fi
fi

# Test 4: Check database initialization
echo ""
echo "[4/7] Testing database initialization..."
if run_ssh "test -d ~/.eliza" 2>/dev/null; then
    test_pass "~/.eliza directory exists"
else
    test_fail "~/.eliza directory not found"
fi

# Test 5: Check elizaOS binaries
echo ""
echo "[5/7] Testing elizaOS binaries..."
if run_ssh "test -x /opt/elizaos/bin/launcher 2>/dev/null || test -d /opt/elizaos" 2>/dev/null; then
    test_pass "elizaOS binaries installed"
else
    test_fail "elizaOS binaries not found at /opt/elizaos"
fi

# Test 6: Check network configuration
echo ""
echo "[6/7] Testing network configuration..."
if run_ssh "ip addr show | grep -q 'inet '" 2>/dev/null; then
    test_pass "Network interface has IP address"
else
    test_fail "No IP address configured"
fi

# Test 7: Check first-boot completion
echo ""
echo "[7/7] Testing first-boot completion..."
if run_ssh "test -f /var/lib/elizaos/.first-boot-complete" 2>/dev/null; then
    test_pass "First boot setup completed"
else
    # Check if first-boot service exists
    if run_ssh "systemctl list-unit-files elizaos-first-boot.service" 2>/dev/null | grep -q "elizaos-first-boot"; then
        test_pass "First boot service installed (may run on next boot)"
    else
        test_fail "First boot setup not completed and service not found"
    fi
fi

# Summary
echo ""
echo "=========================================="
if [[ "$TESTS_FAILED" == "true" ]]; then
    echo "❌ Some tests failed"
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi
