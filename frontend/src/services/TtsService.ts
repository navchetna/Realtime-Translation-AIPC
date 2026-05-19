import { API_CONFIG } from '../config/apiConfig';

class TtsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.TTS_URL;
  }

  /**
   * Calculate audio duration from WAV blob
   */
  private async getAudioDuration(blob: Blob): Promise<number> {
    try {
      // Read WAV header to get duration
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // Check if it's a valid WAV file
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (riff !== 'RIFF') {
        console.warn('[TTS] Not a valid WAV file');
        return 0;
      }

      // Get sample rate (bytes 24-27)
      const sampleRate = view.getUint32(24, true);

      // Get byte rate (bytes 28-31)
      const byteRate = view.getUint32(28, true);

      // Get data size (bytes 40-43 for standard WAV)
      const dataSize = view.getUint32(40, true);

      // Calculate duration: dataSize / byteRate
      const duration = dataSize / byteRate;

      return duration;
    } catch (error) {
      console.error('[TTS] Failed to parse audio duration:', error);
      return 0;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('[TTS] Health check failed:', error);
      return false;
    }
  }

  async synthesizeSpeech(
    text: string,
    language: string = 'ja',
    voice: string = 'alloy',
    speed: number = 1.0
  ): Promise<{ blob: Blob; metrics: { rtf: number; inferenceTime: number; audioDuration: number } }> {
    const startTime = performance.now();

    try {
      console.log('[TTS] Synthesizing:', {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        language,
        voice,
        speed,
      });

      const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          language: language,
          speed: speed,
          response_format: 'wav',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TTS] API error:', response.status, errorText);
        throw new Error(`TTS failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const inferenceTime = (performance.now() - startTime) / 1000;

      // Try to get RTF from header (if backend provides it)
      const rtfHeader = response.headers.get('X-RTF');
      let rtf = rtfHeader ? parseFloat(rtfHeader) : 0;

      // Try to get audio duration from header
      const durationHeader = response.headers.get('X-Audio-Duration');
      let audioDuration = durationHeader ? parseFloat(durationHeader) : 0;

      // If audio duration not in header, parse it from the WAV file
      if (audioDuration === 0) {
        audioDuration = await this.getAudioDuration(blob);
      }

      // Calculate RTF: inference_time / audio_duration
      if (audioDuration > 0) {
        rtf = inferenceTime / audioDuration;
      }

      console.log('[TTS] Synthesis complete:', {
        audioSize: `${(blob.size / 1024).toFixed(1)}KB`,
        inferenceTime: `${(inferenceTime * 1000).toFixed(0)}ms`,
        audioDuration: `${audioDuration.toFixed(2)}s`,
        rtf: rtf.toFixed(3),
        interpretation: rtf < 1 ? 'faster than realtime' : 'slower than realtime',
      });

      return {
        blob,
        metrics: { rtf, inferenceTime, audioDuration },
      };
    } catch (error) {
      console.error('[TTS] Synthesis error:', error);
      throw error;
    }
  }
}

export const ttsService = new TtsService();
