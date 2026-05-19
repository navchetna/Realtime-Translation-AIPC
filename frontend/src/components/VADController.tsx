import { useCallback, useEffect, useRef } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { asrService } from '../services/AsrService';
import { VAD_CONFIG } from '../config/vadConfig';
import type { TranscriptionResult } from '../types';

interface VADControllerProps {
  isListening: boolean;
  inputLanguage: string;
  onTranscript: (result: TranscriptionResult) => void;
  onLog: (msg: string) => void;
  onSpeakingChange: (speaking: boolean) => void;
}

/**
 * VADController is always mounted but controlled via isListening prop.
 * This ensures useMicVAD doesn't reload repeatedly.
 */
export function VADController({
  isListening,
  inputLanguage,
  onTranscript,
  onLog,
  onSpeakingChange,
}: VADControllerProps) {
  const prevLoading = useRef(true);
  const audioQueue = useRef<Float32Array[]>([]);
  const isProcessing = useRef(false);
  const MAX_QUEUE_SIZE = 6;

  const processQueue = useCallback(() => {
    if (isProcessing.current) {
      return;
    }

    const nextAudio = audioQueue.current.shift();
    if (!nextAudio) {
      return;
    }

    isProcessing.current = true;
    console.log('[VAD] 📤 Processing audio:', nextAudio.length, 'samples');

    asrService.transcribeAudio(nextAudio, inputLanguage)
      .then((result) => {
        console.log('[VAD] ✅ ASR result:', result.text);
        if (result.text?.trim()) {
          onTranscript(result);
        }
      })
      .catch((err) => {
        console.error('[VAD] ❌ ASR Error:', err);
      })
      .finally(() => {
        isProcessing.current = false;
        processQueue();
      });
  }, [inputLanguage, onTranscript]);

  const handleSpeechEnd = useCallback((audio: Float32Array) => {
    onSpeakingChange(false);
    console.log('[VAD] 🔴 Speech ended:', audio.length, 'samples');

    audioQueue.current.push(audio.slice());
    if (audioQueue.current.length > MAX_QUEUE_SIZE) {
      audioQueue.current = audioQueue.current.slice(-MAX_QUEUE_SIZE);
    }

    processQueue();
  }, [onSpeakingChange, processQueue]);

  const vad = useMicVAD({
    startOnLoad: false,
    submitUserSpeechOnPause: true,
    onSpeechStart: () => {
      console.log('[VAD] 🎤 Speech started');
      onSpeakingChange(true);
    },
    onSpeechEnd: handleSpeechEnd,
    positiveSpeechThreshold: VAD_CONFIG.POSITIVE_SPEECH_THRESHOLD,
    negativeSpeechThreshold: VAD_CONFIG.NEGATIVE_SPEECH_THRESHOLD,
    minSpeechMs: VAD_CONFIG.MIN_SPEECH_MS,
    redemptionMs: VAD_CONFIG.REDEMPTION_MS,
    baseAssetPath: '/vad-assets/',
    onnxWASMBasePath: '/vad-assets/',
    model: 'v5',
  });

  // Sync VAD state with isListening prop
  useEffect(() => {
    const syncListeningState = async () => {
      if (vad.loading || vad.errored) return;

      try {
        if (isListening && !vad.listening) {
          console.log('[VAD] Starting...');
          await vad.start();
        } else if (!isListening && vad.listening) {
          console.log('[VAD] Stopping...');
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

  // Log VAD loading status
  useEffect(() => {
    if (prevLoading.current && !vad.loading) {
      prevLoading.current = false;
      if (vad.errored) {
        onLog(`✗ VAD failed to load: ${vad.errored}`);
      } else {
        onLog('✓ Silero VAD ready');
      }
    }
  }, [vad.loading, vad.errored, onLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioQueue.current = [];
    };
  }, []);

  return null;
}
