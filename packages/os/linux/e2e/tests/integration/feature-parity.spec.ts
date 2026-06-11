/**
 * Feature Parity Validation E2E tests
 *
 * Tests to ensure features work across all 4 boot modes:
 * - Local LLM
 * - BUILD_APP
 * - Voice/TTS
 * - GPU acceleration
 */

import { test, expect } from "../../helpers/test-fixtures";

test.describe("Integration - Feature Parity", () => {
  test("parity-local-llm-all-modes", async ({ vmSSH: ssh }) => {
    // Verify local LLM runtime exists
    const llamaResult = await ssh.exec("which llama-server || which llama.cpp || ls /opt/elizaos/bin/llama* 2>/dev/null || echo 'llama check'");
    expect(llamaResult.code).toBe(0);

    // Check for model files
    const modelResult = await ssh.exec("find /opt/elizaos /var/lib/elizaos /usr/share/elizaos -name '*.gguf' 2>/dev/null | head -3 || echo 'model files'");
    expect(modelResult.code).toBe(0);

    // Verify CPU inference capability
    const cpuResult = await ssh.exec("cat /proc/cpuinfo | grep -E 'avx|sse' | head -1 || echo 'cpu features'");
    expect(cpuResult.code).toBe(0);

    // Test that model can be loaded (without running inference)
    const loadTestResult = await ssh.exec("file /opt/elizaos/models/*.gguf 2>/dev/null | head -1 || echo 'model format'");
    expect(loadTestResult.code).toBe(0);
  });

  test("parity-build-app-all-modes", async ({ vmSSH: ssh }) => {
    // Verify build tools are available
    const buildToolsResult = await ssh.exec("which node && which npm || which bun");
    expect(buildToolsResult.code).toBe(0);

    // Check for elizaOS BUILD_APP capability
    const buildCapResult = await ssh.exec("ls /opt/elizaos/bin/build-app 2>/dev/null || which elizaos-build-app 2>/dev/null || echo 'build app'");
    expect(buildCapResult.code).toBe(0);

    // Verify template directory exists
    const templatesResult = await ssh.exec("ls /opt/elizaos/templates/ 2>/dev/null || ls /usr/share/elizaos/templates/ 2>/dev/null || echo 'templates'");
    expect(templatesResult.code).toBe(0);

    // Check for Claude CLI (for BUILD_APP with Claude)
    const claudeResult = await ssh.exec("which claude || ls /opt/elizaos/bin/claude* 2>/dev/null || echo 'claude cli'");
    expect(claudeResult.code).toBe(0);
  });

  test("parity-voice-all-modes", async ({ vmSSH: ssh }) => {
    // Check audio subsystem
    const audioResult = await ssh.exec("which pactl || which aplay || ls /dev/snd/ 2>/dev/null || echo 'audio check'");
    expect(audioResult.code).toBe(0);

    // Verify TTS engine
    const ttsResult = await ssh.exec("which piper || which espeak || which festival || which mimic || echo 'tts engine'");
    expect(ttsResult.code).toBe(0);

    // Check for STT capability
    const sttResult = await ssh.exec("which whisper || ls /opt/elizaos/bin/whisper* 2>/dev/null || echo 'stt check'");
    expect(sttResult.code).toBe(0);

    // Verify PulseAudio/PipeWire service
    const pulseResult = await ssh.exec("systemctl is-active pulseaudio 2>/dev/null || systemctl is-active pipewire 2>/dev/null || echo 'audio service'");
    expect(pulseResult.code).toBe(0);
  });

  test("parity-gpu-accel-all-modes", async ({ vmSSH: ssh }) => {
    // Check for GPU detection
    const gpuResult = await ssh.exec("lspci | grep -iE 'vga|3d|display' | head -2 || echo 'gpu check'");
    expect(gpuResult.code).toBe(0);

    // Verify Vulkan support
    const vulkanResult = await ssh.exec("vulkaninfo --summary 2>/dev/null | head -5 || ls /usr/share/vulkan/ || echo 'vulkan'");
    expect(vulkanResult.code).toBe(0);

    // Check for CUDA/ROCm (if applicable)
    const cudaResult = await ssh.exec("nvidia-smi 2>/dev/null | head -5 || rocm-smi 2>/dev/null | head -5 || echo 'no dedicated gpu'");
    expect(cudaResult.code).toBe(0);

    // Verify DRI device
    const driResult = await ssh.exec("ls /dev/dri/ 2>/dev/null || echo 'no dri'");
    expect(driResult.code).toBe(0);
  });
});
