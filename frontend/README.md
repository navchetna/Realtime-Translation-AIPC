# Real-time Translation Demo Frontend

This is a premium, beautifully designed frontend for the Real-time Translation Demo. It relies entirely on native browser features for mocking VAD (Voice Activity Detection), ASR (Speech to Text), and NMT (Machine Translation). 

## Technology Used
- **React.js & Vite**: Fast development server and build tool.
- **Vanilla CSS (Modules)**: Custom high-end glassmorphism styling, variables, and animations (no Tailwind as per requirements).
- **Audio API (`AudioContext`)**: Used for an on-device volume threshold-based mock "VAD" to capture pauses in speech automatically.

## Running Locally

1. Ensure you have Node.js installed.
2. In the `frontend` directory, run:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local network URL in your browser.

## Environment Variables

Copy `.env.example` to `.env` if you want to override local defaults.

- `VITE_STT_API_URL`: STT backend endpoint.
- `VITE_NMT_API_URL`: NMT backend endpoint.
- `VITE_TTS_API_URL`: TTS backend endpoint.
- `VITE_MIN_TRANSCRIPT_BUFFER_WORDS`: Minimum word count required before a transcript is sent immediately for translation. If an ASR segment has fewer words than this value, the frontend buffers it and waits for the next segment, then sends both together in one translation request.
- `VITE_ENABLE_SENTENCE_COMPLETENESS_BUFFER`: When `true`, transcript buffering switches to sentence-completeness mode (minimum words + sentence-ending punctuation + abrupt ending checks for conjunctions/prepositions). When `false`, the app uses the original min-word-only buffering logic.
- `VITE_VAD_POSITIVE_SPEECH_THRESHOLD`: Silero speech probability threshold (0.0 to 1.0).
- `VITE_VAD_NEGATIVE_SPEECH_THRESHOLD`: Silero silence probability threshold (0.0 to 1.0).
- `VITE_VAD_MIN_SPEECH_MS`: Minimum speech duration before a segment is accepted.
- `VITE_VAD_REDEMPTION_MS`: Silence tolerance before speech end is triggered.
- `VITE_PREDEFINED_SUMMARY_TEXT`: Text used by the Generate Summary button. Use `\n` inside the env value if you want explicit line breaks.

## Features

### 1. Settings Sidebar
- **Input Device**: Connects to `navigator.mediaDevices` to enumerate available microphones.
- **Voice Cloning UI**: A static/mock feature demonstrating how a user could type their name and record a 10s voice profile. The UI updates dynamically to prompt reading text and flashes a success toast.

### 2. Live ASR (Automatic Speech Recognition)
- When clicking "Start Listening", the app begins capturing microphone audio.
- The built-in mock VAD detects silence (speech pauses). Once it hits a 1.5s silence gap, it triggers the end of a speech segment.
- Transcripts appear live in the bottom ASR panel.

### 3. Multi-language Translation Panels
- Contains 2 independent boxes for translation (defaults: Hindi and English).
- Each box listens to the latest transcript emitted by the ASR service.
- Features a mock streaming layout using `setInterval` to demonstrate character-by-character text generation similar to actual LLMs or real-time translation APIs.

## How to Integrate Backend Services

This application is ready to be hooked up to real endpoints!
1. **ASR**: Update `src/services/AsrService.ts` to `POST` the `audioBlob` to your `/api/asr` endpoint dynamically.
2. **NMT**: Update `src/services/TranslationService.ts` to `POST` the text string to your `/api/translate` endpoint.
3. **VAD**: For a more advanced on-device VAD, replace the volume threshold logic in `AudioVADService.ts` with Silero VAD (e.g., using `@ricky0123/vad-web`).
