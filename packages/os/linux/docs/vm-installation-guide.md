# elizaOS VM Installation Guide

This guide covers installing elizaOS in virtual machine environments including VirtualBox, VMware, QEMU/KVM, and cloud platforms.

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [VirtualBox Installation](#virtualbox-installation)
4. [VMware Installation](#vmware-installation)
5. [QEMU/KVM Installation](#qemukvm-installation)
6. [Cloud Deployment](#cloud-deployment)
7. [Guided Installation Walkthrough](#guided-installation-walkthrough)
8. [Post-Installation Setup](#post-installation-setup)
9. [Troubleshooting](#troubleshooting)
10. [Enterprise Deployment](#enterprise-deployment)

---

## Quick Start

### One-Line Import Commands

**VirtualBox:**
```bash
VBoxManage import elizaos-vm-1.0.0-amd64.ova --vsys 0 --vmname "elizaOS"
VBoxManage startvm "elizaOS"
```

**VMware Workstation:**
```bash
vmrun -T ws clone elizaos-vm-1.0.0-amd64.ova elizaos-vm.vmx thin
vmrun -T ws start elizaos-vm.vmx
```

**QEMU/KVM:**
```bash
qemu-system-x86_64 -m 4G -smp 4 -enable-kvm \
  -drive file=elizaos-vm-1.0.0-amd64.qcow2,format=qcow2 \
  -device virtio-net-pci,netdev=net0 \
  -netdev user,id=net0,hostfwd=tcp::3000-:3000
```

**Libvirt/virt-manager:**
```bash
virt-install --import --name elizaos \
  --disk elizaos-vm-1.0.0-amd64.qcow2 \
  --memory 4096 --vcpus 4 \
  --os-variant debian12 \
  --network default \
  --graphics spice
```

---

## System Requirements

### Minimum Requirements

| Resource | Requirement |
|----------|-------------|
| CPU | 2 cores (x86_64 or ARM64) |
| RAM | 4 GB |
| Disk | 20 GB |
| Network | NAT or bridged adapter |

### Recommended Requirements

| Resource | Requirement |
|----------|-------------|
| CPU | 4+ cores |
| RAM | 8+ GB |
| Disk | 50+ GB SSD |
| Network | Bridged with internet access |
| GPU | Optional: for local LLM inference |

### VM Feature Requirements

- Hardware virtualization (VT-x/AMD-V)
- Nested virtualization (optional, for containers)
- USB passthrough (optional, for hardware wallets)

---

## VirtualBox Installation

### Step 1: Download OVA

Download the latest `elizaos-vm-{version}-amd64.ova` from:
- GitHub Releases: https://github.com/elizaos/eliza/releases
- Direct link: `https://releases.elizaos.io/vm/latest.ova`

### Step 2: Import Appliance

1. Open VirtualBox Manager
2. Click **File → Import Appliance**
3. Select the downloaded `.ova` file
4. Review settings and click **Import**

### Step 3: Configure VM (Optional)

Before starting, you may want to adjust:

- **Memory**: Increase to 8GB if available
- **Processors**: Match your host cores (4+ recommended)
- **Network**: Change to "Bridged Adapter" for direct network access
- **USB**: Enable USB 3.0 controller if needed

### Step 4: Start VM

1. Select "elizaOS" in VirtualBox
2. Click **Start**
3. Wait for boot and follow the guided installer

### Troubleshooting VirtualBox

**Black screen on boot:**
- Enable "EFI (Special OSes only)" in System settings
- Ensure VT-x is enabled in BIOS

**Poor performance:**
- Install VirtualBox Guest Additions (pre-installed in elizaOS)
- Enable 3D acceleration in Display settings
- Increase video memory to 128MB

---

## VMware Installation

### VMware Workstation / Fusion

1. **Open OVA**: File → Open... → Select `.ova`
2. **Import**: Accept license, choose storage location
3. **Configure**: Adjust resources in VM Settings
4. **Start**: Power on the VM

### VMware ESXi / vSphere

```bash
# Using ovftool
ovftool --acceptAllEulas \
  --name=elizaOS \
  --datastore=datastore1 \
  --network="VM Network" \
  elizaos-vm-1.0.0-amd64.ova \
  ******esxi-host
```

### VMware Player (Free)

1. Open VMware Player
2. Select "Open a Virtual Machine"
3. Browse to `.ova` file
4. Follow import wizard

---

## QEMU/KVM Installation

### Direct QEMU

```bash
# Create and start VM
qemu-system-x86_64 \
  -name elizaOS \
  -machine type=q35,accel=kvm \
  -cpu host \
  -smp cores=4 \
  -m 4G \
  -drive file=elizaos-vm.qcow2,format=qcow2,if=virtio \
  -device virtio-net-pci,netdev=net0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::3000-:3000 \
  -display gtk \
  -device virtio-tablet-pci
```

### With virt-manager (GUI)

1. Open virt-manager
2. Click "Create a new virtual machine"
3. Select "Import existing disk image"
4. Browse to `.qcow2` file
5. Set OS to "Debian 12"
6. Allocate 4GB RAM, 4 CPUs
7. Complete wizard and start

### With libvirt CLI

```bash
# Define VM from XML
cat <<EOF > elizaos.xml
<domain type='kvm'>
  <name>elizaOS</name>
  <memory unit='GiB'>4</memory>
  <vcpu>4</vcpu>
  <os>
    <type arch='x86_64'>hvm</type>
    <boot dev='hd'/>
  </os>
  <features>
    <acpi/><apic/>
  </features>
  <devices>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='/var/lib/libvirt/images/elizaos-vm.qcow2'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    <interface type='network'>
      <source network='default'/>
      <model type='virtio'/>
    </interface>
    <graphics type='spice' autoport='yes'/>
    <video><model type='qxl'/></video>
    <channel type='spicevmc'>
      <target type='virtio' name='com.redhat.spice.0'/>
    </channel>
  </devices>
</domain>
EOF

virsh define elizaos.xml
virsh start elizaOS
```

---

## Cloud Deployment

### AWS EC2

```bash
# Import VMDK as AMI
aws ec2 import-image \
  --description "elizaOS" \
  --disk-containers "file://containers.json"

# containers.json
{
  "Description": "elizaOS VM",
  "Format": "vmdk",
  "Url": "s3://bucket/elizaos-vm.vmdk"
}

# Launch instance from AMI
aws ec2 run-instances \
  --image-id ami-xxxxxxxxx \
  --instance-type t3.large \
  --key-name your-keypair
```

### Google Cloud

```bash
# Create image from RAW disk
gcloud compute images create elizaos-image \
  --source-uri gs://bucket/elizaos-vm.raw

# Create instance
gcloud compute instances create elizaos-vm \
  --image elizaos-image \
  --machine-type e2-standard-4
```

### Azure

```bash
# Create managed disk from VHD
az disk create \
  --resource-group mygroup \
  --name elizaos-disk \
  --source https://account.blob.core.windows.net/container/elizaos-vm.vhd

# Create VM from disk
az vm create \
  --resource-group mygroup \
  --name elizaos-vm \
  --attach-os-disk elizaos-disk \
  --os-type Linux
```

### Cloud-Init Configuration

elizaOS supports cloud-init for automated provisioning:

```yaml
#cloud-config
hostname: elizaos-prod
users:
  - name: admin
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... admin@company
    sudo: ALL=(ALL) NOPASSWD:ALL
runcmd:
  - systemctl enable --now elizaos-agent
write_files:
  - path: /var/lib/elizaos/config.json
    content: |
      {
        "provider": "anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}"
      }
```

---

## Guided Installation Walkthrough

When booting from the installer ISO, you'll be guided through these steps:

### Step 1: Welcome

- Select your language
- Choose keyboard layout
- Detected locale is pre-selected

### Step 2: License

- Review GPL-3.0 and Apache-2.0 dual license
- Accept to proceed

### Step 3: Installation Type

| Option | Description |
|--------|-------------|
| **VM Disk** | Full installation to virtual disk (recommended) |
| **USB Persistent** | Install to USB with encrypted persistence |
| **Live Session** | Boot without installation |

### Step 4: Disk Selection

- Shows available disks with safety classification
- Internal disks marked with warning
- Select target disk for installation

### Step 5: User Setup

- **Username**: Unprivileged user account
- **Password**: User and sudo password
- **Hostname**: Machine network name
- **SSH Key** (optional): Public key for remote access

### Step 6: Privacy Mode

| Option | Description |
|--------|-------------|
| **Direct** | Standard internet connection |
| **Tor** | Route all traffic through Tor network |
| **MAC Spoofing** | Randomize network hardware address |
| **Encryption** | Encrypt persistent storage |

### Step 7: Agent Onboarding

- **Provider**: Local, Anthropic, OpenAI, etc.
- **API Key**: For cloud providers
- **Voice**: Enable text-to-speech
- **Telemetry**: Anonymous usage statistics

### Step 8: Review & Install

- Summary of all selections
- Click "Install" to begin
- Progress bar shows installation status

---

## Post-Installation Setup

### First Boot

After installation completes and VM reboots:

1. Login with your created user
2. The elizaOS agent will start automatically
3. Open browser to `http://localhost:3000`

### Configure Agent

```bash
# Set API key
elizaos config set ANTHROPIC_API_KEY=sk-ant-...

# Configure agent name
elizaos config set AGENT_NAME="My Assistant"

# Enable plugins
elizaos plugin enable twitter
elizaos plugin enable discord
```

### Access Web Interface

The elizaOS web interface runs on port 3000:

- Local: `http://localhost:3000`
- From host: `http://VM_IP:3000`

### SSH Access

```bash
# From host machine
ssh eliza@localhost -p 2222  # If using port forwarding
ssh eliza@VM_IP              # If using bridged network
```

### Update elizaOS

```bash
# Check for updates
elizaos update check

# Apply updates
elizaos update apply
```

---

## Troubleshooting

### VM Won't Boot

**Symptoms**: Black screen, no GRUB menu

**Solutions**:
1. Enable EFI mode in VM settings
2. Ensure disk is set as primary boot device
3. Verify hardware virtualization is enabled in BIOS
4. Check VM has sufficient memory (minimum 2GB)

### Network Not Working

**Symptoms**: No internet, can't reach API

**Solutions**:
1. Verify VM network adapter is connected
2. Try bridged mode instead of NAT
3. Check host firewall rules
4. Run `systemctl restart NetworkManager` in VM

### Slow Performance

**Symptoms**: Laggy UI, slow responses

**Solutions**:
1. Install/verify guest additions:
   ```bash
   # VirtualBox
   sudo apt install virtualbox-guest-utils
   
   # VMware
   sudo apt install open-vm-tools open-vm-tools-desktop
   
   # QEMU
   sudo apt install spice-vdagent qemu-guest-agent
   ```
2. Increase VM memory and CPUs
3. Use virtio drivers for disk/network
4. Enable disk caching in VM settings

### elizaOS Agent Won't Start

**Symptoms**: Port 3000 not responding

**Solutions**:
```bash
# Check service status
systemctl status elizaos-agent

# View logs
journalctl -u elizaos-agent -f

# Restart service
sudo systemctl restart elizaos-agent

# Check database
elizaos db:status
elizaos db:migrate
```

### Can't Access Web Interface

**Symptoms**: Browser shows "connection refused"

**Solutions**:
1. Verify agent is running: `systemctl status elizaos-agent`
2. Check firewall: `sudo ufw allow 3000/tcp`
3. Verify port forwarding in VM settings
4. Try accessing from within VM first

---

## Enterprise Deployment

### Answer Files

For automated deployment, create an answer file:

```json
{
  "installType": "vm-disk",
  "targetDisk": "/dev/sda",
  "user": {
    "username": "svc-elizaos",
    "password": "$(vault get elizaos/password)",
    "hostname": "elizaos-prod-01",
    "sshPublicKey": "ssh-ed25519 AAAA..."
  },
  "locale": {
    "language": "en_US",
    "timezone": "America/New_York",
    "keyboardLayout": "us"
  },
  "privacy": {
    "networkMode": "direct",
    "macSpoof": false,
    "persistenceEncryption": true
  },
  "agent": {
    "providerType": "anthropic",
    "providerApiKey": "${ANTHROPIC_API_KEY}",
    "enableVoice": false,
    "enableTelemetry": false
  }
}
```

Deploy with:
```bash
ELIZAOS_INSTALL_MODE=answer-file \
ELIZAOS_ANSWER_FILE=/path/to/answers.json \
/opt/elizaos-installer/bin/elizaos-auto-install
```

### Fleet Management

For managing multiple elizaOS VMs:

1. **Ansible Playbook**:
```yaml
- hosts: elizaos_fleet
  tasks:
    - name: Update elizaOS
      command: elizaos update apply
      
    - name: Configure agent
      template:
        src: elizaos-config.json.j2
        dest: /var/lib/elizaos/config.json
      notify: restart elizaos-agent
```

2. **Terraform Module**:
```hcl
module "elizaos_vm" {
  source = "./modules/elizaos-vm"
  
  count         = 5
  name_prefix   = "elizaos-worker"
  memory_mb     = 8192
  vcpus         = 4
  disk_size_gb  = 100
  
  agent_config = {
    provider = "anthropic"
    api_key  = var.anthropic_api_key
  }
}
```

### Security Hardening

For production deployments:

```bash
# Enable firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3000/tcp

# Disable password auth
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Enable automatic updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Run security audit
elizaos security audit
```

---

## Support

- **Documentation**: https://elizaos.ai/docs
- **GitHub Issues**: https://github.com/elizaos/eliza/issues
- **Discord**: https://discord.gg/elizaos
- **Email**: support@elizaos.ai

---

*This guide is part of the elizaOS documentation. Licensed under Apache-2.0.*
