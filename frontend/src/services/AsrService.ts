import { API_CONFIG } from '../config/apiConfig';
import type { TranscriptionResult } from '../types';

export interface AsrMetrics {
  latency_ms: number;
  audio_duration_s: number;
  rtf: number;
}

export interface AsrResult {
  text: string;
  metrics: AsrMetrics | null;
}

class AsrService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.ASR_URL;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('[ASR] Health check failed:', error);
      return false;
    }
  }

  /**
   * Convert Float32Array to WAV Blob for OpenAI API
   * Creates a proper WAV file with headers
   */
  private audioToWavBlob(audio: Float32Array, sampleRate: number = 16000): Blob {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audio.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV Header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert Float32 samples to Int16
    const offset = 44;
    for (let i = 0; i < audio.length; i++) {
      const sample = Math.max(-1, Math.min(1, audio[i]));
      view.setInt16(offset + i * 2, sample * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Transcribe audio using OpenAI-compatible API
   * Sends Float32Array PCM audio (16kHz mono) as WAV file
   */
  async transcribeAudio(
    audio: Float32Array,
    language: string = 'en'
  ): Promise<TranscriptionResult> {
    try {
      // Convert Float32Array to WAV blob
      const wavBlob = this.audioToWavBlob(audio, 16000);

      // Create FormData for OpenAI API
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0.0');

      const startTime = performance.now();
      const response = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ASR failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const latency = performance.now() - startTime;

      console.log('[ASR] Response:', { text: data.text, duration: data.duration, language: data.language });

      return {
        text: data.text || '',
        timestamp: new Date(),
        metrics: {
          rtf: data.duration > 0 ? (latency / 1000) / data.duration : 0,
          audio_duration_s: data.duration || 0,
          inference_time_s: latency / 1000,
        },
      };
    } catch (error) {
      console.error('[ASR] Transcription error:', error);
      throw error;
    }
  }
}

export const asrService = new AsrService();
