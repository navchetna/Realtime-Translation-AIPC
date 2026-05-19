/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASR_URL?: string
  readonly VITE_TTS_URL?: string
  readonly VITE_LLM_URL?: string
  readonly VITE_OLLAMA_MODEL?: string
  readonly VITE_ASR_MODEL_NAME?: string
  readonly VITE_LLM_MODEL_NAME?: string
  readonly VITE_TTS_MODEL_NAME?: string
  readonly VITE_DEFAULT_INPUT_LANGUAGE?: string
  readonly VITE_DEFAULT_OUTPUT_LANGUAGE?: string
  readonly VITE_DEFAULT_TTS_VOICE?: string
  readonly VITE_DEFAULT_TTS_SPEED?: string
  readonly VITE_LLM_TRANSLATION_PROMPT?: string
  readonly VITE_VAD_POSITIVE_SPEECH_THRESHOLD?: string
  readonly VITE_VAD_NEGATIVE_SPEECH_THRESHOLD?: string
  readonly VITE_VAD_MIN_SPEECH_MS?: string
  readonly VITE_VAD_REDEMPTION_MS?: string
  readonly VITE_VAD_PRE_SPEECH_PAD_FRAMES?: string
  readonly VITE_VAD_MIN_SPEECH_FRAMES?: string
  readonly VITE_VAD_REDEMPTION_FRAMES?: string
  readonly VITE_VAD_MAX_QUEUE_SIZE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
