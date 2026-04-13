import { useCallback, useEffect, useRef } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { AsrService } from '../services/AsrService';
import type { AsrMetrics } from '../services/AsrService';
import { VAD_CONFIG } from '../config/vadConfig';

interface Props {
  isListening: boolean;
  onTranscript: (text: string) => void;
  onLog: (msg: string) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onAsrMetrics?: (metrics: AsrMetrics) => void;
}

/**
 * VADController is mounted ONLY after the user clicks "Start Listening".
 * This ensures useMicVAD (which loads a ~2MB ONNX model) never blocks the
 * initial page render.
 */
export function VADController({ isListening, onTranscript, onLog, onSpeakingChange, onAsrMetrics }: Props) {
  const prevLoading = useRef(true);

  const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
    onSpeakingChange(false);
    try {
      const exactPcmBytes = new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength).slice();
      const audioBlob = new Blob([exactPcmBytes], { type: 'application/octet-stream' });
      const { text, metrics } = await AsrService.transcribeAudio(audioBlob);
      if (text?.trim()) onTranscript(text);
      if (metrics && onAsrMetrics) onAsrMetrics(metrics);
    } catch (err) {
      console.error('ASR Error:', err);
    }
  }, [onTranscript, onSpeakingChange, onAsrMetrics]);

  const vad = useMicVAD({
    // Preload model/runtime on mount but keep microphone off until user starts.
    startOnLoad: false,
    onSpeechStart: () => onSpeakingChange(true),
    onSpeechEnd: handleSpeechEnd,
    positiveSpeechThreshold: VAD_CONFIG.POSITIVE_SPEECH_THRESHOLD,
    negativeSpeechThreshold: VAD_CONFIG.NEGATIVE_SPEECH_THRESHOLD,
    minSpeechMs: VAD_CONFIG.MIN_SPEECH_MS,
    redemptionMs: VAD_CONFIG.REDEMPTION_MS,
    baseAssetPath: '/vad-assets/',
    onnxWASMBasePath: '/vad-assets/',
    model: 'v5',
  });

  useEffect(() => {
    const syncListeningState = async () => {
      if (vad.loading || vad.errored) return;

      try {
        if (isListening && !vad.listening) {
          await vad.start();
        } else if (!isListening && vad.listening) {
          await vad.pause();
          onSpeakingChange(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onLog(`✗ VAD runtime error: ${msg}`);
      }
    };

    void syncListeningState();
  }, [isListening, vad.loading, vad.errored, vad.listening, vad.start, vad.pause, onLog, onSpeakingChange]);

  useEffect(() => {
    if (prevLoading.current && !vad.loading) {
      prevLoading.current = false;
      if (vad.errored) {
        onLog(`✗ VAD failed to load: ${vad.errored}`);
      } else {
        onLog('✓ Silero VAD ready. You can start listening now.');
      }
    }
    if (vad.loading) {
      // keep the log updated while loading
    }
  }, [vad.loading, vad.errored, onLog]);

  // This component renders nothing visible — it's purely a logic controller
  return null;
}
