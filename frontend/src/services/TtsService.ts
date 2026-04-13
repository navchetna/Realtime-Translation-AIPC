export interface TtsMetrics {
  latency_ms: number;
  audio_duration_s: number;
  rtf: number;
}

export interface TtsSynthesizeResult {
  audioBlob: Blob;
  metrics: TtsMetrics | null;
}

export class TtsService {
  private static readonly ttsLangMap: Record<string, string> = {
    Hindi: 'hi',
    Bengali: 'bn',
    Tamil: 'ta',
    Telugu: 'te',
    Kannada: 'kn',
    Malayalam: 'ml',
    Punjabi: 'pa',
  };

  static async synthesize(text: string, targetLanguage: string): Promise<TtsSynthesizeResult> {
    const sentence = text.trim();
    if (!sentence) {
      throw new Error('Cannot synthesize empty text');
    }

    const sourceLanguage = this.ttsLangMap[targetLanguage];
    if (!sourceLanguage) {
      throw new Error(`TTS is not available for ${targetLanguage}`);
    }

    const apiUrl = import.meta.env.VITE_TTS_API_URL || 'http://localhost:5000/tts';
    const usePipelinePayload = apiUrl.includes('/services/inference/pipeline');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        usePipelinePayload
          ? {
              pipelineTasks: [
                {
                  taskType: 'tts',
                  config: {
                    language: {
                      sourceLanguage,
                    },
                    gender: 'female',
                    samplingRate: 48000,
                  },
                },
              ],
              inputData: {
                input: [
                  {
                    source: sentence,
                  },
                ],
              },
            }
          : {
              text: sentence,
              language: sourceLanguage,
              gender: 'female',
              samplingRate: 48000,
            }
      ),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const base64Audio = usePipelinePayload
      ? data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent
      : data?.audioContent;
    const metrics = (usePipelinePayload
      ? data?.pipelineResponse?.[0]?.metrics
      : data?.metrics) as TtsMetrics | undefined;

    if (!base64Audio || typeof base64Audio !== 'string') {
      throw new Error('Invalid TTS response: audio content missing');
    }

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      audioBlob: new Blob([bytes], { type: 'audio/wav' }),
      metrics: metrics ?? null,
    };
  }
}
