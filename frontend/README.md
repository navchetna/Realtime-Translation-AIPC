# Voice Translation with VAD - Frontend

Modern React + TypeScript frontend with Voice Activity Detection (VAD) for real-time speech-to-speech translation.

## Features

- 🎤 **Automatic Voice Detection** - Silero VAD v5 neural network
- 🚀 **Real-time Processing** - Sequential audio queue (max 6 segments)
- 📊 **Performance Metrics** - RTF, tokens/sec, latency tracking
- 🌐 **Multi-language Support** - 30+ languages
- 🎨 **Modern UI** - React + TypeScript + Vite
- 🔊 **Interactive Playback** - Click Japanese text to play audio
- ⚙️ **Fully Configurable** - Environment-based configuration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` to configure your setup (see Configuration section below).

### 3. Setup Ollama

Install and configure Ollama for translation:

```bash
# Install Ollama from https://ollama.ai

# Pull a model (choose one)
ollama pull llama3.2
ollama pull mistral
ollama pull gemma2
```

**See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for detailed instructions.**

### 4. Start Backend Services

Make sure ASR and TTS services are running:

```bash
# From project root
cd backend\ASR
start_server.bat

# In another terminal
cd backend\TTS
start_server.bat
```

### 5. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

### 6. Start Using

1. Click **"Start Listening"**
2. Grant microphone permissions
3. Speak in English
4. Watch real-time translation appear!

## Configuration

All configuration is done via environment variables in `.env.local`:

### Backend Services

```env
# Backend API URLs
VITE_ASR_URL=http://localhost:8001
VITE_TTS_URL=http://localhost:8000
VITE_LLM_URL=http://localhost:11434

# Ollama Model (see OLLAMA_SETUP.md)
VITE_OLLAMA_MODEL=llama3.2
```

### Model Names

Displayed in the UI:

```env
VITE_ASR_MODEL_NAME=Whisper Base (OpenVINO)
VITE_LLM_MODEL_NAME=Ollama (llama3.2)
VITE_TTS_MODEL_NAME=Supertonic TTS (OpenVINO)
```

### VAD Configuration

Fine-tune Voice Activity Detection:

```env
# Speech detection thresholds (0.0 - 1.0)
VITE_VAD_POSITIVE_THRESHOLD=0.5   # Speech detected above this
VITE_VAD_NEGATIVE_THRESHOLD=0.35  # Silence detected below this

# Timing parameters (in frames)
VITE_VAD_MIN_SPEECH_FRAMES=4      # ~250ms minimum speech
VITE_VAD_REDEMPTION_FRAMES=5      # ~300ms pause tolerance
VITE_VAD_PRE_SPEECH_PAD_FRAMES=1  # Pre-speech padding

# Audio processing
VITE_VAD_FRAME_SAMPLES=1536       # Samples per frame (96ms at 16kHz)
VITE_VAD_SAMPLE_RATE=16000        # Audio sample rate
VITE_VAD_MAX_QUEUE_SIZE=6         # Maximum queued segments
```

### Translation Prompt

Customize the translation prompt for Ollama:

```env
VITE_LLM_TRANSLATION_PROMPT=You are a professional translator. Translate the following text from {sourceLang} to {targetLang}. Provide only the translation without any explanations or additional text.\n\nText to translate: {text}\n\nTranslation:
```

Variables available:
- `{sourceLang}` - Source language name
- `{targetLang}` - Target language name
- `{text}` - Text to translate

**Note:** You can change the Ollama model at any time. See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for details.

### Default Settings

```env
VITE_DEFAULT_INPUT_LANGUAGE=en
VITE_DEFAULT_OUTPUT_LANGUAGE=ja
VITE_DEFAULT_TTS_VOICE=alloy
VITE_DEFAULT_TTS_SPEED=1.0
```

## Architecture

### VAD Pipeline

```
Microphone (16kHz mono)
    ↓
Silero VAD v5
    ↓
Speech Detection (configurable thresholds)
    ↓
Audio Queue (max 6 segments)
    ↓
Sequential Processing
    ↓
ASR → LLM → TTS
```

### Components

- **App.tsx** - Main application orchestrator
- **VADController.tsx** - Manages VAD and audio queue
- **TranscriptionPanel.tsx** - Displays transcriptions
- **MetricsDisplay.tsx** - Shows performance metrics
- **ConfigPanel.tsx** - Configuration controls

### Services

- **AsrService.ts** - Speech recognition API client
- **TtsService.ts** - Text-to-speech API client
- **TranslationService.ts** - Ollama translation API client

## Usage

### Voice Detection

1. **Click "Start Listening"**
   - VAD model loads (~2MB, one-time)
   - Grant microphone permission when prompted

2. **Speak Naturally**
   - VAD automatically detects speech
   - No need to click record/stop
   - Tolerates natural pauses

3. **View Results**
   - Left panel: English transcriptions
   - Right panel: Japanese translations
   - Click Japanese text to play audio

### Configuration Options

#### Input/Output Languages

- **Input**: English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese
- **Output**: Japanese, English, Spanish, French, German, Korean, Chinese

#### TTS Voices

- Alloy - Neutral, balanced
- Echo - Clear, articulate
- Fable - Expressive, storytelling
- Onyx - Deep, authoritative
- Nova - Warm, friendly
- Shimmer - Bright, energetic

#### TTS Speed

Adjustable from 0.25x to 2.0x

## Performance

### Typical Metrics

- **VAD Processing**: <10ms per frame
- **Queue Processing**: 100-300ms per segment
- **ASR Latency**: 50-200ms (GPU), 200-500ms (CPU)
- **TTS Latency**: 100-400ms (GPU), 500-1500ms (CPU)
- **Total E2E**: 300-1000ms typical

### Optimization Tips

**Reduce Latency:**
- Enable GPU on backend services
- Lower TTS diffusion steps (6-8)
- Use smaller ASR models (whisper-base)

**Improve Accuracy:**
- Speak clearly near microphone
- Minimize background noise
- Use larger ASR models (whisper-large)
- Adjust VAD thresholds

**Resource Usage:**
- VAD model: ~2MB (one-time download)
- Memory: <50MB typical
- CPU: Minimal (processing in backend)

## Troubleshooting

### Microphone Not Working

1. **Grant permissions** in browser (click lock icon)
2. **Check system microphone** is connected and working
3. **Use HTTPS or localhost** (mic requires secure context)
4. **Try different browser** (Chrome recommended)

### VAD Model Not Loading

1. **Check internet connection** (CDN download required)
2. **Clear browser cache**
3. **Check console** for errors
4. **Wait for download** (~2MB, may take time on slow connections)

### Speech Not Detected

1. **Speak louder** or closer to microphone
2. **Reduce background noise**
3. **Adjust VAD thresholds** in `.env.local`:
   ```env
   VITE_VAD_POSITIVE_THRESHOLD=0.4  # Lower = more sensitive
   VITE_VAD_NEGATIVE_THRESHOLD=0.3
   ```
4. **Check microphone levels** in system settings

### Backend Not Responding

1. **Verify services running**:
   ```bash
   curl http://localhost:8001/health  # ASR
   curl http://localhost:8000/health  # TTS
   ```

2. **Check CORS enabled** on backend

3. **Verify URLs** in `.env.local`

4. **Check firewall** settings

### Slow Performance

1. **Enable GPU** on backend services
2. **Use smaller models** (whisper-base vs whisper-large)
3. **Reduce TTS quality** (fewer diffusion steps)
4. **Check network latency**

### Queue Issues

- **Queue Full**: Speak more slowly or increase `VITE_VAD_MAX_QUEUE_SIZE`
- **Dropped Segments**: Improve backend performance
- **Delayed Processing**: Enable GPU acceleration

## Development

### Build for Production

```bash
npm run build
npm run preview
```

### Project Structure

```
frontend-vad/
├── src/
│   ├── components/
│   │   ├── VADController.tsx
│   │   ├── TranscriptionPanel.tsx
│   │   ├── MetricsDisplay.tsx
│   │   └── ConfigPanel.tsx
│   ├── services/
│   │   ├── AsrService.ts
│   │   ├── TtsService.ts
│   │   └── TranslationService.ts
│   ├── config/
│   │   ├── vadConfig.ts      # VAD settings (env-based)
│   │   └── apiConfig.ts      # API config (env-based)
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── .env.example              # Configuration template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Customization

**Modify VAD Behavior:**
Edit `.env.local` VAD settings

**Change Styling:**
Edit `src/App.css`

**Add Languages:**
Edit `src/components/ConfigPanel.tsx`

**Modify API Integration:**
Edit `src/services/*.ts`

### TypeScript Types

See `src/types/index.ts` for:
- `TranscriptionResult`
- `TranslationResult`
- `SessionMetrics`
- `ListeningState`
- `AudioSegment`

## Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✅ Excellent | Recommended |
| Edge | 90+ | ✅ Excellent | Recommended |
| Firefox | 88+ | ⚠️ Good | VAD may be slower |
| Safari | 14+ | ⚠️ Good | Limited mic support |
| Mobile | Varies | ⚠️ Limited | Restricted mic access |

## Ollama Integration

This frontend uses **Ollama** for local LLM-based translation. See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for:

- Installing and configuring Ollama
- Choosing and pulling models
- Changing models on the fly
- Performance tuning and troubleshooting

### Quick Ollama Commands

```bash
# Pull a model
ollama pull llama3.2

# List installed models
ollama list

# Test Ollama
curl http://localhost:11434/api/tags

# Change model (update .env.local)
VITE_OLLAMA_MODEL=mistral
```

## Credits

- **VAD**: [@ricky0123/vad-react](https://github.com/ricky0123/vad)
- **Silero VAD**: [Silero Models](https://github.com/snakers4/silero-vad)
- **React**: [React 18](https://react.dev/)
- **Vite**: [Vite](https://vitejs.dev/)
- **TypeScript**: [TypeScript](https://www.typescriptlang.org/)

## License

MIT

## Support

For issues and questions:
- Check browser console for errors
- Verify backend services are running
- Review configuration in `.env.local`
- Check [Main README](../README.md) for system setup
