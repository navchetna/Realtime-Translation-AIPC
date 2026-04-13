export interface AsrMetrics {
  latency_ms: number;
  audio_duration_s: number;
  rtf: number;
}

export interface AsrResult {
  text: string;
  metrics: AsrMetrics | null;
}

export class AsrService {
  /**
   * Sends a raw Float32Array PCM audio buffer (16kHz mono) to the ASR backend.
   * Silero VAD provides audio already decoded as Float32Array at 16kHz,
   * so no re-encoding or AudioContext decoding is needed.
   */
  static async transcribeAudio(audioBlob: Blob, sourceLanguage: string = 'hi'): Promise<AsrResult> {
    const apiUrl = import.meta.env.VITE_STT_API_URL || 'http://localhost:8002/services/inference/pipeline';

    // audioBlob is already raw Float32 PCM bytes — convert directly to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: 'asr',
              config: {
                language: { sourceLanguage },
                postProcessors: ['itn', 'punctuation']
              }
            }
          ],
          inputData: {
            audio: [{ audioContent: base64Audio }]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ASR request failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.pipelineResponse[0].output[0].source,
        metrics: (data.pipelineResponse[0].metrics as AsrMetrics) ?? null,
      };
    } catch (e) {
      console.warn('ASR backend failed:', e);
      return { text: '', metrics: null };
    }
  }
}
