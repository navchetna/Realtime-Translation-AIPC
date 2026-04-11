import { useCallback, useEffect, useRef } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { AsrService } from '../services/AsrService';
import { VAD_CONFIG } from '../config/vadConfig';

interface Props {
  onTranscript: (text: string) => void;
  onLog: (msg: string) => void;
  onSpeakingChange: (speaking: boolean) => void;
}

/**
 * VADController is mounted ONLY after the user clicks "Start Listening".
 * This ensures useMicVAD (which loads a ~2MB ONNX model) never blocks the
 * initial page render.
 */
export function VADController({ onTranscript, onLog, onSpeakingChange }: Props) {
  const prevLoading = useRef(true);

  const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
    onSpeakingChange(false);
    try {
      const audioBlob = new Blob([audio.buffer as ArrayBuffer], { type: 'audio/pcm' });
      const text = await AsrService.transcribeAudio(audioBlob);
      if (text?.trim()) onTranscript(text);
    } catch (err) {
      console.error('ASR Error:', err);
    }
  }, [onTranscript, onSpeakingChange]);

  const vad = useMicVAD({
    startOnLoad: true,   // start immediately once this component mounts
    onSpeechStart: () => onSpeakingChange(true),
    onSpeechEnd: handleSpeechEnd,
    positiveSpeechThreshold: VAD_CONFIG.POSITIVE_SPEECH_THRESHOLD,
    negativeSpeechThreshold: VAD_CONFIG.NEGATIVE_SPEECH_THRESHOLD,
    minSpeechMs: VAD_CONFIG.MIN_SPEECH_MS,
    redemptionMs: VAD_CONFIG.REDEMPTION_MS,
    baseAssetPath: '/',
    onnxWASMBasePath: '/',
    model: 'v5',
  });

  useEffect(() => {
    if (prevLoading.current && !vad.loading) {
      prevLoading.current = false;
      if (vad.errored) {
        onLog(`✗ VAD failed to load: ${vad.errored}`);
      } else {
        onLog('✓ Silero VAD ready — now listening for speech.');
      }
    }
    if (vad.loading) {
      // keep the log updated while loading
    }
  }, [vad.loading, vad.errored, onLog]);

  // This component renders nothing visible — it's purely a logic controller
  return null;
}
