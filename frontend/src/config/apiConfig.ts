/**
 * API Configuration for backend services
 * Loaded from environment variables
 */

export const API_CONFIG = {
  // ASR Service (Speech Recognition)
  ASR_URL: import.meta.env.VITE_ASR_URL || 'http://localhost:8001',

  // TTS Service (Text-to-Speech)
  TTS_URL: import.meta.env.VITE_TTS_URL || 'http://localhost:8000',

  // Ollama Service (Translation)
  LLM_URL: import.meta.env.VITE_LLM_URL || 'http://localhost:11434',

  // Ollama Model Name
  OLLAMA_MODEL: import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2',
} as const;

export const MODEL_NAMES = {
  ASR: import.meta.env.VITE_ASR_MODEL_NAME || 'Whisper (OpenVINO)',
  LLM: import.meta.env.VITE_LLM_MODEL_NAME || 'Translation Model',
  TTS: import.meta.env.VITE_TTS_MODEL_NAME || 'Supertonic TTS (OpenVINO)',
} as const;

export const DEFAULT_CONFIG = {
  inputLanguage: import.meta.env.VITE_DEFAULT_INPUT_LANGUAGE || 'en',
  outputLanguage: import.meta.env.VITE_DEFAULT_OUTPUT_LANGUAGE || 'ja',
  ttsVoice: import.meta.env.VITE_DEFAULT_TTS_VOICE || 'alloy',
  ttsSpeed: parseFloat(import.meta.env.VITE_DEFAULT_TTS_SPEED || '1.0'),
} as const;

export const LLM_TRANSLATION_PROMPT =
  import.meta.env.VITE_LLM_TRANSLATION_PROMPT ||
  'You are a professional translator. Translate the following text from {sourceLang} to {targetLang}. Provide only the translation without any explanations or additional text.\n\nText to translate: {text}\n\nTranslation:';

export type ApiConfig = typeof API_CONFIG;
export type DefaultConfig = typeof DEFAULT_CONFIG;
