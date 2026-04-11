/**
 * Silero VAD Configuration
 * 
 * These parameters control the @ricky0123/vad-react Silero VAD model.
 * Silero VAD uses a neural network to classify speech vs. non-speech frames.
 * Each "frame" is 96 samples at 16kHz (~6ms).
 *
 * Reference: https://github.com/ricky0123/vad
 */
export const VAD_CONFIG = {
  /**
   * Probability threshold above which a frame is considered speech.
   * Higher value = less sensitive (ignores soft speech / background noise).
   * Range: 0.0 – 1.0   Default: 0.5
   */
  POSITIVE_SPEECH_THRESHOLD: 0.5,

  /**
   * Probability threshold below which a frame is considered silence.
   * Should be lower than POSITIVE_SPEECH_THRESHOLD to create hysteresis.
   * Range: 0.0 – 1.0   Default: 0.35
   */
  NEGATIVE_SPEECH_THRESHOLD: 0.35,

  /**
   * Minimum speech duration (ms) before triggering onSpeechStart.
   * Prevents very short noises (clicks, pops) from triggering a speech segment.
   * Default: 250ms
   */
  MIN_SPEECH_MS: 250,

  /**
   * Duration of silence (ms) to tolerate inside a speech segment before ending it.
   * Higher value = more forgiving of short pauses within a sentence.
   * Default: 300ms
   */
  REDEMPTION_MS: 300,
};
