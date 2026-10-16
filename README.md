# Realtime Translation Demo (AI PC)

Real-time speech-to-speech translation running fully on-device on an Intel AI PC. A user speaks in English; the system transcribes the speech, translates it, and speaks the translation back, with live transcripts shown in the browser.

## Target

Demonstrate low-latency, fully local voice translation using Intel hardware (CPU/GPU via OpenVINO), without any cloud dependency:

- **Speech recognition**: Whisper (OpenVINO GenAI)
- **Translation**: a local LLM served by Ollama
- **Speech synthesis**: Supertonic TTS (OpenVINO)

## Architecture

```
Microphone
    │  audio
    ▼
[Frontend — port 3000]     React + TypeScript UI
    │
    ├──► [ASR  — port 8001]   Whisper, OpenVINO       speech → text
    ├──► [LLM  — port 11434]  Ollama                  text → translated text
    └──► [TTS  — port 8000]   Supertonic, OpenVINO     text → speech
```

All three backend services expose OpenAI-compatible REST APIs and run independently; the frontend orchestrates calls between them.

## Prerequisites

| Tool | Notes |
|------|-------|
| Windows 10/11 (64-bit) | |
| [Node.js](https://nodejs.org/) 18+ | Frontend dev server and build |
| [uv](https://github.com/astral-sh/uv) | Python environments for ASR/TTS — installed automatically by the setup scripts if missing |
| [Ollama](https://ollama.com/) | Local LLM runtime — installed automatically by `backend\LLM\setup.bat` if missing |
| ffmpeg, espeak-ng | Required by the TTS service — checked/installed by `backend\TTS\setup.bat` |
| Intel GPU driver (optional) | For OpenVINO GPU acceleration |

RAM: 8 GB minimum, 16 GB recommended. Disk: ~5 GB free for models.

## Quick Setup

Run the centralized setup script from the repo root. It sets up ASR, LLM, TTS and the frontend in sequence:

```bat
setup.bat
```

## Manual Setup

Each component can also be set up individually:

```bat
cd backend\ASR && setup.bat   REM Whisper ASR
cd backend\LLM && setup.bat   REM Ollama + translation model
cd backend\TTS && setup.bat   REM Supertonic TTS
cd frontend     && npm install
```

See each folder's README for configuration details:
- [backend/ASR/README.md](backend/ASR/README.md)
- [backend/LLM/README.md](backend/LLM/README.md)
- [backend/TTS/README.md](backend/TTS/README.md)
- [frontend/README.md](frontend/README.md)

## Running the Application

Start all services at once:

```bat
start_services.bat
```

Or start each service in its own terminal:

```bat
REM Terminal 1 — ASR
cd backend\ASR
start_server.bat

REM Terminal 2 — TTS
cd backend\TTS
start_server.bat

REM Terminal 3 — Frontend
cd frontend
npm run dev
```

Ollama runs automatically as a background service once installed. Then open **http://localhost:3000** in your browser.

## Configuration

The frontend reads backend URLs and defaults from environment variables (`frontend/.env.local`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ASR_URL` | `http://localhost:8001` | ASR service URL |
| `VITE_TTS_URL` | `http://localhost:8000` | TTS service URL |
| `VITE_LLM_URL` | `http://localhost:11434` | Ollama service URL |
| `VITE_OLLAMA_MODEL` | `llama3.2` | Ollama model used for translation |
| `VITE_DEFAULT_INPUT_LANGUAGE` | `en` | Source language |
| `VITE_DEFAULT_OUTPUT_LANGUAGE` | `ja` | Target language |

## Project Structure

```
Realtime-Translation-AIPC/
├── backend/
│   ├── ASR/   Whisper speech recognition service (OpenVINO)
│   ├── LLM/   Ollama-based translation setup
│   └── TTS/   Supertonic text-to-speech service (OpenVINO)
├── frontend/      React + TypeScript web UI
├── setup.bat      Centralized setup for all components
└── start_services.bat   Starts ASR, TTS and the frontend together
```

## License

See individual component licenses:
- OpenVINO: Apache 2.0
- Whisper: MIT
- Ollama: MIT
- FastAPI: MIT

