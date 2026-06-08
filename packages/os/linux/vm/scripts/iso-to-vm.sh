#!/usr/bin/env bash
#
# iso-to-vm.py — Convert elizaOS ISO to VM image with automated installation
#
# This script boots an ISO in QEMU with an answer file to perform
# an unattended installation, producing a ready-to-use VM image.
#
set -euo pipefail

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Convert elizaOS ISO to VM image with automated installation.

Options:
    -i, --input FILE        Input ISO file (required)
    -o, --output FILE       Output VM image file (default: elizaos-vm.qcow2)
    -f, --format FORMAT     Output format: qcow2, raw, vmdk, vdi (default: qcow2)
    -s, --disk-size SIZE    Disk size (default: 50G)
    -m, --memory SIZE       Memory in MB (default: 4096)
    -c, --cpus N            Number of CPUs (default: 2)
    -a, --auto-install      Use unattended installation
    --timeout SECS          Installation timeout (default: 1800)
    -h, --help              Show this help

Examples:
    $(basename "$0") -i elizaos-installer.iso -o elizaos.qcow2
    $(basename "$0") -i elizaos-installer.iso -f vmdk -s 100G
EOF
}

# Defaults
INPUT_ISO=""
OUTPUT_FILE="elizaos-vm.qcow2"
OUTPUT_FORMAT="qcow2"
DISK_SIZE="50G"
MEMORY=4096
CPUS=2
AUTO_INSTALL=false
TIMEOUT=1800

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -i|--input)
            INPUT_ISO="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -s|--disk-size)
            DISK_SIZE="$2"
            shift 2
            ;;
        -m|--memory)
            MEMORY="$2"
            shift 2
            ;;
        -c|--cpus)
            CPUS="$2"
            shift 2
            ;;
        -a|--auto-install)
            AUTO_INSTALL=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate input
if [[ -z "$INPUT_ISO" ]]; then
    echo "ERROR: Input ISO required (-i/--input)"
    usage
    exit 1
fi

if [[ ! -f "$INPUT_ISO" ]]; then
    echo "ERROR: Input ISO not found: $INPUT_ISO"
    exit 1
fi

echo "=========================================="
echo "elizaOS ISO to VM Converter"
echo "=========================================="
echo "Input:  $INPUT_ISO"
echo "Output: $OUTPUT_FILE"
echo "Format: $OUTPUT_FORMAT"
echo "Disk:   $DISK_SIZE"
echo "Memory: ${MEMORY}MB"
echo "CPUs:   $CPUS"
echo ""

# Create temporary disk for installation
TEMP_DISK="${OUTPUT_FILE%.qcow2}.temp.qcow2"
echo "[1/5] Creating temporary disk image..."
qemu-img create -f qcow2 "$TEMP_DISK" "$DISK_SIZE"

# Create answer file for unattended installation
ANSWER_FILE=$(mktemp)
if [[ "$AUTO_INSTALL" == "true" ]]; then
    echo "[2/5] Creating answer file for unattended installation..."
    cat > "$ANSWER_FILE" <<EOF
{
    "installType": "vm-disk",
    "targetDisk": "/dev/sda",
    "user": {
        "username": "eliza",
        "password": "eliza",
        "hostname": "elizaos",
        "rootPassword": "eliza"
    },
    "locale": {
        "language": "en_US",
        "timezone": "UTC",
        "keyboardLayout": "us"
    },
    "privacy": {
        "networkMode": "direct",
        "macSpoof": false,
        "persistenceEncryption": false
    },
    "agent": {
        "providerType": "local",
        "enableVoice": false
    }
}
EOF
fi

# Create cloud-init seed ISO if auto-install
SEED_ISO=""
if [[ "$AUTO_INSTALL" == "true" ]]; then
    echo "[3/5] Creating cloud-init seed..."
    SEED_DIR=$(mktemp -d)
    
    cat > "$SEED_DIR/meta-data" <<EOF
instance-id: elizaos-vm-$(date +%s)
local-hostname: elizaos
EOF

    cat > "$SEED_DIR/user-data" <<EOF
#cloud-config
autoinstall:
  version: 1
  locale: en_US.UTF-8
  keyboard:
    layout: us
  storage:
    layout:
      name: direct
  identity:
    hostname: elizaos
    username: eliza
    password: $(echo -n 'eliza' | openssl passwd -6 -stdin)
  ssh:
    install-server: true
  packages:
    - qemu-guest-agent
runcmd:
  - systemctl enable qemu-guest-agent
  - cp /cdrom/answer.json /var/lib/elizaos/.install-answers.json || true
EOF

    # Create seed ISO
    SEED_ISO="${TEMP_DISK%.qcow2}.seed.iso"
    if command -v genisoimage &>/dev/null; then
        genisoimage -output "$SEED_ISO" -volid cidata -joliet -rock "$SEED_DIR"
    elif command -v mkisofs &>/dev/null; then
        mkisofs -output "$SEED_ISO" -volid cidata -joliet -rock "$SEED_DIR"
    else
        echo "WARNING: genisoimage/mkisofs not found, skipping cloud-init seed"
        SEED_ISO=""
    fi
    rm -rf "$SEED_DIR"
fi

# Build QEMU command
QEMU_CMD=(
    qemu-system-x86_64
    -m "$MEMORY"
    -smp "$CPUS"
    -enable-kvm
    -nographic
    -drive "file=$TEMP_DISK,format=qcow2,if=virtio"
    -drive "file=$INPUT_ISO,media=cdrom,readonly=on"
    -boot d
    -serial mon:stdio
    -device virtio-net-pci,netdev=net0
    -netdev user,id=net0
)

if [[ -n "$SEED_ISO" ]]; then
    QEMU_CMD+=(-drive "file=$SEED_ISO,media=cdrom,readonly=on")
fi

# Run installation
echo "[4/5] Running installation (timeout: ${TIMEOUT}s)..."
echo "This may take several minutes..."
echo ""

# For auto-install, we'd run QEMU and wait for completion
# For manual install, we just prepare the disk
if [[ "$AUTO_INSTALL" == "true" ]]; then
    echo "Starting unattended installation..."
    timeout "$TIMEOUT" "${QEMU_CMD[@]}" || {
        EXIT_CODE=$?
        if [[ $EXIT_CODE -eq 124 ]]; then
            echo "WARNING: Installation timed out after ${TIMEOUT}s"
        fi
    }
else
    echo "Manual installation mode: launching QEMU..."
    echo "Complete the installation manually, then shut down the VM."
    "${QEMU_CMD[@]}"
fi

# Convert to final format
echo "[5/5] Converting to final format ($OUTPUT_FORMAT)..."
case "$OUTPUT_FORMAT" in
    qcow2)
        mv "$TEMP_DISK" "$OUTPUT_FILE"
        ;;
    raw)
        qemu-img convert -f qcow2 -O raw "$TEMP_DISK" "$OUTPUT_FILE"
        rm -f "$TEMP_DISK"
        ;;
    vmdk)
        qemu-img convert -f qcow2 -O vmdk "$TEMP_DISK" "$OUTPUT_FILE"
        rm -f "$TEMP_DISK"
        ;;
    vdi)
        qemu-img convert -f qcow2 -O vdi "$TEMP_DISK" "$OUTPUT_FILE"
        rm -f "$TEMP_DISK"
        ;;
    *)
        echo "ERROR: Unknown format: $OUTPUT_FORMAT"
        rm -f "$TEMP_DISK"
        exit 1
        ;;
esac

# Cleanup
rm -f "$ANSWER_FILE" "$SEED_ISO"

echo ""
echo "=========================================="
echo "✅ VM image created: $OUTPUT_FILE"
echo ""
echo "To test the image:"
echo "  qemu-system-x86_64 -m 4G -enable-kvm -drive file=$OUTPUT_FILE"
echo ""
echo "To import to VirtualBox:"
echo "  VBoxManage convertfromraw $OUTPUT_FILE ${OUTPUT_FILE%.qcow2}.vdi --format VDI"
echo "=========================================="
