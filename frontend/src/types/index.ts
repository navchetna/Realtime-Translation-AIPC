export interface TranscriptionResult {
  text: string;
  timestamp: Date;
  metrics?: {
    rtf: number;
    audio_duration_s: number;
    inference_time_s: number;
  };
}

export interface TranslationMetrics {
  tokensPerSec: number;
  latency_ms: number;
}

export interface TranslationResult {
  text: string;
  timestamp: Date;
  audioBlob?: Blob;
  metrics: TranslationMetrics;
}

export interface SessionMetrics {
  asrRTF: number;
  llmTokensPerSec: number;
  ttsRTF: number;
  totalLatency: number;
}

export type ListeningState = 'idle' | 'loading' | 'listening' | 'speaking' | 'processing';

export interface AudioSegment {
  audio: Float32Array;
  timestamp: Date;
}
