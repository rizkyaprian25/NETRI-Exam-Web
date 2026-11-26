// Mesin Sintesis Sirine Darurat Web Audio API (1:1 dengan MainActivity.kt Android)
// Menghasilkan gelombang wailing tajam rentang 600 Hz - 1400 Hz dengan harmonik ke-3 tanpa file audio eksternal

import { EXAM_METRICS } from '@/contracts/exam';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __NETRI_SIREN_PLAY_COUNT__?: number;
    __NETRI_SIREN_ACTIVE__?: boolean;
  }
}

class SirenAudioEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.audioCtx) return this.audioCtx;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.audioCtx = new AudioCtx();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Membuka kunci Autoplay AudioContext tepat pada gesture klik siswa
   * sebelum ujian dimulai (wajib untuk Chrome Android & iOS Safari)
   */
  public async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch {
      // Abaikan jika browser menolak resume sebelum interaksi penuh
    }
  }

  /** Membangun buffer sirine periodik 0.4 detik (2.5 siklus/detik) identik dengan generator PCM Android */
  private buildSirenBuffer(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate || 44100;
    const durationSeconds = 0.4;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    const modFreq = 2.5;
    const carrierFreq = 1000.0;
    const freqDeviation = 400.0;

    for (let i = 0; i < numSamples; i += 1) {
      const t = i / sampleRate;
      const phase =
        2.0 *
        Math.PI *
        (carrierFreq * t -
          (freqDeviation / (2.0 * Math.PI * modFreq)) *
            Math.sin(2.0 * Math.PI * modFreq * t));
      const raw = 0.75 * Math.sin(phase) + 0.25 * Math.sin(3.0 * phase);
      channelData[i] = Math.max(-1, Math.min(1, raw / 0.85));
    }

    return buffer;
  }

  public start(durationMs = EXAM_METRICS.SIREN_DURATION_MS): void {
    if (typeof window === 'undefined') return;
    if (this.active) return;

    this.active = true;
    window.__NETRI_SIREN_ACTIVE__ = true;
    window.__NETRI_SIREN_PLAY_COUNT__ = (window.__NETRI_SIREN_PLAY_COUNT__ ?? 0) + 1;

    const ctx = this.ensureContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
        const buffer = this.buildSirenBuffer(ctx);
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 1.0;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        this.sourceNode = source;
      } catch {
        // Jika audio terblokir kebijakan browser, status visual & timer tetap berjalan
      }
    }

    // Berikan getaran tambahan di perangkat mobile yang mendukung Vibration API
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 300]);
      }
    } catch {
      // Abaikan jika tidak didukung
    }

    if (durationMs > 0) {
      this.stopTimer = setTimeout(() => {
        this.stop();
      }, durationMs);
    }
  }

  public stop(): void {
    this.active = false;
    if (typeof window !== 'undefined') {
      window.__NETRI_SIREN_ACTIVE__ = false;
    }

    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Abaikan jika node sudah berhenti
      }
      this.sourceNode = null;
    }
  }

  public get isPlaying(): boolean {
    return this.active;
  }
}

export const sharedSirenAudio = new SirenAudioEngine();
