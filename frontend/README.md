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

## Features

### 1. Settings Sidebar
- **Input Device**: Connects to `navigator.mediaDevices` to enumerate available microphones.
- **Voice Cloning UI**: A static/mock feature demonstrating how a user could type their name and record a 10s voice profile. The UI updates dynamically to prompt reading text and flashes a success toast.

### 2. Live ASR (Automatic Speech Recognition)
- When clicking "Start Listening", the app begins capturing microphone audio.
- The built-in mock VAD detects silence (speech pauses). Once it hits a 1.5s silence gap, it triggers the end of a speech segment.
- Transcripts appear live in the bottom ASR panel.

### 3. Multi-language Translation Panels
- Contains 3 independent boxes for translation.
- Each box listens to the latest transcript emitted by the ASR service.
- Features a mock streaming layout using `setInterval` to demonstrate character-by-character text generation similar to actual LLMs or real-time translation APIs.

## How to Integrate Backend Services

This application is ready to be hooked up to real endpoints!
1. **ASR**: Update `src/services/AsrService.ts` to `POST` the `audioBlob` to your `/api/asr` endpoint dynamically.
2. **NMT**: Update `src/services/TranslationService.ts` to `POST` the text string to your `/api/translate` endpoint.
3. **VAD**: For a more advanced on-device VAD, replace the volume threshold logic in `AudioVADService.ts` with Silero VAD (e.g., using `@ricky0123/vad-web`).
