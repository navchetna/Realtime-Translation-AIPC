# Voice-to-Voice Real-time Translation System

🎤 → 📝 → 🌐 → 🔊

Modern real-time speech-to-speech translation system with English to Japanese translation using OpenVINO-accelerated ASR and TTS models.

## Features

### 🎯 Core Capabilities
- **Real-time Speech Recognition** - OpenVINO Whisper ASR
- **Neural Translation** - Ollama-powered local LLM translation
- **High-Quality TTS** - Supertonic TTS with OpenVINO
- **OpenAI-Compatible APIs** - Drop-in replacement for OpenAI services
- **GPU Acceleration** - Intel OpenVINO support
- **Multiple Languages** - 30+ languages supported

### 🎨 User Interface
- **Modern Web Interface** - Responsive dark theme
- **Live Transcriptions** - Real-time English and Japanese panels
- **Interactive Playback** - Click any text to hear audio
- **Performance Metrics** - RTF, tokens/sec, latency tracking
- **Session Management** - Track translations and audio time
- **Configurable Settings** - Adjust languages, voices, speed

### ⚡ Performance
- **Low Latency** - Optimized for real-time processing
- **GPU Acceleration** - Intel GPU and dedicated GPU support
- **Efficient Models** - FP16/FP32 precision options
- **Batch Processing** - Multiple audio files support

## Quick Start

### 🔧 Initial Setup (First Time Only)

```batch
# One-command setup for all services
setup_services.bat
```

This automated setup will:
- ✅ Install frontend dependencies and build
- ✅ Set up ASR environment and download models
- ✅ Set up TTS environment, download models, and convert to OpenVINO
- ✅ Install Ollama and pull translation models

**Time**: 15-30 minutes | **See**: [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions

**Note**: For Ollama setup, see [frontend/OLLAMA_SETUP.md](frontend/OLLAMA_SETUP.md)

### 1️⃣ Start All Services

**Windows (PowerShell):**
```powershell
.\start_all.ps1
```

**Windows (Batch):**
```batch
# Start each service in separate terminals

# Terminal 1 - Frontend
cd frontend && npm run dev

# Terminal 2 - ASR
cd backend\ASR && start_server.bat

# Terminal 3 - TTS
cd backend\TTS && start_server.bat

# Terminal 4 - Ollama (install from https://ollama.ai)
ollama serve  # (usually runs automatically)
```

Then open your browser to: **http://localhost:3000** (or configured port)

### 2️⃣ Manual Setup (If Needed)

**Setup ASR:**
```batch
cd backend\ASR
setup.bat
```

**Setup TTS:**
```batch
cd backend\TTS
setup.bat
```

**Setup Ollama:**
```bash
# Install from https://ollama.ai
# Then pull a model
ollama pull llama3.2
```

**Setup Frontend:**
```batch
cd frontend
npm install
npm run build
```

## System Requirements

- **OS**: Windows 10/11
- **Python**: 3.10 or higher
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space
- **GPU** (Optional): Intel GPU or NVIDIA GPU for acceleration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React-like UI)                  │
│                     Port 8080 (Web Server)                   │
└────────┬──────────────────────┬───────────────────┬─────────┘
         │                      │                   │
         ▼                      ▼                   ▼
    ┌────────┐           ┌──────────┐        ┌──────────┐
    │  ASR   │           │  Ollama  │        │   TTS    │
    │ :8001  │  ──────>  │  :11434  │  ───>  │  :8000   │
    │Whisper │           │Translation│        │Supertonic│
    └────────┘           └──────────┘        └──────────┘
```

## Project Structure

```
Voice-to-Voice/
├── backend/
│   ├── ASR/                    # Whisper Speech Recognition
│   │   ├── server.py          # OpenAI-compatible API
│   │   ├── setup.ps1          # Setup script
│   │   ├── start_server.ps1   # Start script
│   │   ├── requirements.txt   # Dependencies
│   │   └── README_API.md      # API documentation
│   │
│   ├── TTS/                    # Supertonic Text-to-Speech
│   │   ├── api_server.py      # OpenAI-compatible API
│   │   ├── setup.ps1          # Setup script
│   │   ├── start_server.ps1   # Start script
│   │   ├── requirements_api.txt
│   │   ├── Supertonic/        # TTS implementation
│   │   └── README_API.md      # API documentation
│   │
│   └── (Ollama runs separately) # Local LLM for translation
│
├── frontend/                   # Web Interface
│   ├── index.html             # Main application
│   ├── app.js                 # JavaScript logic
│   ├── styles.css             # Styling
│   ├── config.js              # Configuration
│   ├── serve.py               # HTTP server
│   └── README.md              # Frontend docs
│
├── start_all.ps1              # Start all services
├── SETUP_GUIDE.md             # Detailed setup guide
└── README.md                  # This file
```

## Configuration

### Environment Variables

**ASR Service:**
```env
ASR_DEVICE=GPU              # CPU, GPU, AUTO
ASR_MODEL_NAME=openvino/whisper-base
PORT=8001
HOST=0.0.0.0
```

**TTS Service:**
```env
DEVICE=GPU                  # CPU, GPU, AUTO
PRECISION=fp32              # fp16, fp32
DIFFUSION_STEPS=8           # 4-16
DEFAULT_LANGUAGE=ja
DEFAULT_VOICE=alloy
PORT=8000
HOST=0.0.0.0
```

**Ollama:**
```bash
# Pull any model you want to use
ollama pull llama3.2
ollama pull mistral
ollama pull gemma2

# See frontend/OLLAMA_SETUP.md for details
```

**Frontend:**
```env
# .env or .env.local
VITE_ASR_URL=http://localhost:8001
VITE_LLM_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.2
VITE_TTS_URL=http://localhost:8000
```

## Usage

### Recording Audio

1. Click **"Start Recording"**
2. Speak in English
3. Click **"Stop Recording"**
4. Watch real-time translation

### Uploading Files

1. Click **"Upload Audio"**
2. Select audio file (WAV, MP3, FLAC, etc.)
3. View transcription and translation

### Playing Translations

- **Click any Japanese text** to play that sentence
- **Click "Play All"** to play all translations sequentially

## Documentation

- 📖 [Detailed Setup Guide](SETUP_GUIDE.md)
- 🤖 [Ollama Setup Guide](frontend/OLLAMA_SETUP.md)
- 📚 [ASR API Documentation](backend/ASR/README_API.md)
- 📚 [TTS API Documentation](backend/TTS/README_API.md)
- 📚 [Frontend Documentation](frontend/README.md)

## Credits

Built with:
- **OpenVINO** - AI inference optimization
- **Whisper** - Speech recognition
- **Ollama** - Local LLM for translation
- **Supertonic TTS** - Text-to-speech
- **FastAPI** - API framework
- **React + TypeScript** - Frontend

## License

See individual component licenses:
- OpenVINO: Apache 2.0
- Whisper: MIT
- FastAPI: MIT

---

**Made with ❤️ using OpenVINO and modern web technologies**
