/**
 * Silero VAD Configuration
 */
const parseNumberEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseThresholdEnv = (value: string | undefined, fallback: number) => {
  const parsed = parseNumberEnv(value, fallback);
  return parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

const parsePositiveIntEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const VAD_CONFIG = {
  POSITIVE_SPEECH_THRESHOLD: parseThresholdEnv(import.meta.env.VITE_VAD_POSITIVE_SPEECH_THRESHOLD, 0.5),
  NEGATIVE_SPEECH_THRESHOLD: parseThresholdEnv(import.meta.env.VITE_VAD_NEGATIVE_SPEECH_THRESHOLD, 0.35),
  MIN_SPEECH_MS: parsePositiveIntEnv(import.meta.env.VITE_VAD_MIN_SPEECH_MS, 250),
  REDEMPTION_MS: parsePositiveIntEnv(import.meta.env.VITE_VAD_REDEMPTION_MS, 300),
};
