#!/usr/bin/env bash
#
# run-suite.sh — elizaOS VM E2E test suite orchestration
#
# Orchestrates the full E2E test suite including VM lifecycle management,
# test execution, and artifact collection.
#
# Usage:
#   ./run-suite.sh [OPTIONS] [TEST_SUITE]
#
# Options:
#   --iso PATH         Path to ISO image (default: auto-detect from out/)
#   --qcow2 PATH       Path to qcow2 image (default: auto-detect from out/)
#   --memory MB        VM memory in MB (default: 4096)
#   --cpus N           VM CPU cores (default: 2)
#   --timeout SEC      Test timeout in seconds (default: 600)
#   --record           Enable recording mode (screenshots, video)
#   --headless         Run without display (default in CI)
#   --no-kvm           Disable KVM acceleration
#   --help             Show this help
#
# Test Suites:
#   installer          Run installer wizard tests
#   boot-modes         Run boot mode matrix tests
#   services           Run service tests
#   integration        Run integration tests
#   all                Run all tests (default)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="${SCRIPT_DIR}"
LINUX_DIR="${SCRIPT_DIR}/.."
OUT_DIR="${LINUX_DIR}/out"

# Defaults
ISO_PATH=""
QCOW2_PATH=""
MEMORY_MB=4096
CPUS=2
TIMEOUT=600
RECORD=""
HEADLESS=""
KVM_ENABLED=true
TEST_SUITE="all"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --iso)
            ISO_PATH="$2"
            shift 2
            ;;
        --qcow2)
            QCOW2_PATH="$2"
            shift 2
            ;;
        --memory)
            MEMORY_MB="$2"
            shift 2
            ;;
        --cpus)
            CPUS="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --record)
            RECORD="1"
            shift
            ;;
        --headless)
            HEADLESS="1"
            shift
            ;;
        --no-kvm)
            KVM_ENABLED=false
            shift
            ;;
        --help|-h)
            head -28 "$0" | tail -27
            exit 0
            ;;
        installer|boot-modes|services|integration|all)
            TEST_SUITE="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Auto-detect images
if [[ -z "$ISO_PATH" ]]; then
    ISO_PATH=$(find "$OUT_DIR" -name "*.iso" 2>/dev/null | sort | tail -1 || true)
fi

if [[ -z "$QCOW2_PATH" ]]; then
    QCOW2_PATH=$(find "$OUT_DIR" -name "*.qcow2" 2>/dev/null | sort | tail -1 || true)
fi

echo "=========================================="
echo "elizaOS VM E2E Test Suite"
echo "=========================================="
echo "Suite:    $TEST_SUITE"
echo "ISO:      ${ISO_PATH:-none}"
echo "QCOW2:    ${QCOW2_PATH:-none}"
echo "Memory:   ${MEMORY_MB}MB"
echo "CPUs:     $CPUS"
echo "Timeout:  ${TIMEOUT}s"
echo "KVM:      $KVM_ENABLED"
echo "Record:   ${RECORD:-no}"
echo ""

# Check prerequisites
check_prereqs() {
    local missing=""
    
    command -v qemu-system-x86_64 >/dev/null 2>&1 || missing="$missing qemu-system-x86_64"
    command -v bun >/dev/null 2>&1 || missing="$missing bun"
    
    if [[ -n "$missing" ]]; then
        echo "ERROR: Missing required tools:$missing"
        exit 1
    fi
    
    if [[ "$KVM_ENABLED" == "true" ]] && [[ ! -r /dev/kvm ]]; then
        echo "WARNING: KVM not available, falling back to TCG (slower)"
        KVM_ENABLED=false
    fi
    
    if [[ -z "$ISO_PATH" ]] && [[ -z "$QCOW2_PATH" ]]; then
        echo "ERROR: No VM image found. Run 'just build' or 'just vm-build' first."
        exit 1
    fi
}

# Install dependencies
install_deps() {
    cd "$E2E_DIR"
    
    if [[ ! -d "node_modules" ]]; then
        echo "Installing dependencies..."
        bun install
    fi
    
    # Install Playwright browsers if needed
    bun playwright install --with-deps chromium 2>/dev/null || true
}

# Run tests
run_tests() {
    local project=""
    
    case "$TEST_SUITE" in
        installer)
            project="vm-installer"
            ;;
        boot-modes)
            project="vm-boot-modes"
            ;;
        services)
            project="vm-services"
            ;;
        integration)
            project="vm-integration"
            ;;
        all)
            project=""
            ;;
    esac
    
    cd "$E2E_DIR"
    
    # Set environment
    export ELIZAOS_OUT_DIR="$OUT_DIR"
    export ELIZAOS_VM_MEMORY="$MEMORY_MB"
    export ELIZAOS_VM_CPUS="$CPUS"
    export ELIZAOS_BOOT_TIMEOUT="$((TIMEOUT * 1000))"
    export E2E_VM_TIMEOUT="$((TIMEOUT * 1000))"
    
    if [[ "$KVM_ENABLED" == "false" ]]; then
        export ELIZAOS_ENABLE_KVM="0"
    fi
    
    if [[ -n "$RECORD" ]]; then
        export E2E_RECORD="1"
    fi
    
    # Run Playwright tests
    local cmd="bun --bun playwright test"
    
    if [[ -n "$project" ]]; then
        cmd="$cmd --project=$project"
    fi
    
    if [[ -n "${CI:-}" ]]; then
        cmd="$cmd --reporter=list,html"
    fi
    
    echo ""
    echo "Running tests..."
    echo "Command: $cmd"
    echo ""
    
    eval "$cmd"
}

# Collect artifacts
collect_artifacts() {
    local artifacts_dir="${E2E_DIR}/test-artifacts"
    mkdir -p "$artifacts_dir"
    
    # Copy test results
    if [[ -d "${E2E_DIR}/test-results" ]]; then
        cp -r "${E2E_DIR}/test-results" "$artifacts_dir/"
    fi
    
    # Copy Playwright report
    if [[ -d "${E2E_DIR}/playwright-report" ]]; then
        cp -r "${E2E_DIR}/playwright-report" "$artifacts_dir/"
    fi
    
    echo ""
    echo "Artifacts collected in: $artifacts_dir"
}

# Main
main() {
    check_prereqs
    install_deps
    
    local exit_code=0
    run_tests || exit_code=$?
    
    collect_artifacts
    
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo "✅ All tests passed!"
    else
        echo "❌ Some tests failed (exit code: $exit_code)"
    fi
    
    exit $exit_code
}

main
