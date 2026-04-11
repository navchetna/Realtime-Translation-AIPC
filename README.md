# Real-time Multi-lingual Translation Demo

A high-performance, real-time application for translating continuous speech into multiple Indic languages simultaneously. This project uses advanced AI models for Speech-to-Text (STT) and Neural Machine Translation (NMT), running optimally on Intel hardware via the **OpenVINO** inference engine.

## Features

- **Real-Time Speech Capture**: Client-side Voice Activity Detection (VAD) using Silero VAD over ONNX Runtime Web — no server round-trip for silence detection.
- **IndicConformer ASR**: Processes raw PCM Float32 audio buffers (16 kHz mono) directly — no file I/O overhead. Supports 22 Indic languages.
- **Tri-Panel Machine Translation**: Transcribed text is sent in a single batch request and translated into 3 configurable Indic languages simultaneously.
- **Intel-Themed UI**: Glass-morphism aesthetic with live audio detection status and collapsible panels.
- **Bhashini-Compatible API**: Backend servers expose the Bhashini pipeline API format, making them drop-in replaceable with the cloud service.

---

## Architecture

```
Microphone
    │
    ▼
[Browser — Silero VAD]          client-side silence detection (ONNX Runtime Web)
    │  audio chunk (Float32 PCM)
    ▼
[STT Server — port 8002]        IndicConformer ASR  (OpenVINO, FP16)
    │  transcript text
    ▼
[NMT Server — port 8004]        IndicTrans2 Indic→Indic  (OpenVINO, FP16)
    │                           (or port 8003 for EN→Indic)
    ▼
[Frontend]                      3 language panels updated in real time
```

### Models

| Component | Model | Format | Device |
|-----------|-------|--------|--------|
| ASR | [ai4bharat/indic-conformer-600m-multilingual](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) | OpenVINO FP16 | CPU / GPU |
| NMT Indic→Indic | [ai4bharat/indictrans2-indic-indic-1B](https://huggingface.co/ai4bharat/indictrans2-indic-indic-1B) | OpenVINO FP16 | GPU |
| NMT EN→Indic | [ai4bharat/indictrans2-en-indic-1B](https://huggingface.co/ai4bharat/indictrans2-en-indic-1B) | OpenVINO FP16 | GPU |
| VAD | [Silero VAD](https://github.com/snakers4/silero-vad) | ONNX (browser) | — |

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Frontend dev server & build |
| [uv](https://github.com/astral-sh/uv) | latest | Python venv + fast package install |
| Python | 3.10 (STT) / 3.12 (NMT) | Backend servers |
| Intel GPU driver | latest | OpenVINO GPU inference |
| HuggingFace account | — | Downloading gated models |

---

## Quick Setup (Windows)

The `setup.bat` script in the repo root handles everything — model download, OpenVINO conversion, and frontend build — in one go.

```bat
REM 1. Set your HuggingFace token (required for model downloads)
set HF_TOKEN=your_hf_token_here

REM 2. Run the full setup
setup.bat
```

The script will:
1. Create a Python 3.10 venv in `backend/STT/.venv`, install deps, download the IndicConformer model and convert it to OpenVINO FP16.
2. Create a Python 3.12 venv in `backend/NMT/.venv`, install deps, download both IndicTrans2 models and convert them to OpenVINO FP16.
3. Run `npm install` in `frontend/`, copy VAD/ONNX Runtime assets, and build the production bundle.

> **Estimated time**: 30–60 min depending on internet speed and GPU (model conversion is the longest step).

---

## Manual Setup

### STT — IndicConformer ASR (`backend/STT`)

```bat
cd backend\STT

REM Create venv (Python 3.10 required)
uv venv --python=3.10 .venv
.venv\Scripts\activate

REM Install dependencies
uv pip install -r requirements.txt

REM Download model from HuggingFace (requires HF_TOKEN env var)
set HF_TOKEN=your_hf_token_here
python download_all.py
REM  -- or using hf CLI:
REM hf download ai4bharat/indic-conformer-600m-multilingual --local-dir conformer_model

REM Convert ONNX assets to OpenVINO FP16 IR
python convert_to_openvino_fp16.py
```

Output models are written to `backend/STT/openvino_models/`.

---

### NMT — IndicTrans2 (`backend/NMT`)

```bat
cd backend\NMT

REM Create venv (Python 3.12 required)
uv venv --python=3.12 .venv
.venv\Scripts\activate

REM Install PyTorch (CPU-only build — only needed for conversion)
uv pip install torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu

REM Install remaining dependencies
uv pip install -r requirements.txt
uv pip install indictranstoolkit

REM Convert Indic->Indic model (FP16, GPU)
python convert_indictrans2_ov.py ^
    --model-name ai4bharat/indictrans2-indic-indic-1B ^
    --output-dir ./openvino_models/indictrans2-indic-indic-1B-fp16/optimum ^
    --device GPU --precision FP16

REM Convert EN->Indic model (FP16, GPU)
python convert_indictrans2_ov.py ^
    --model-name ai4bharat/indictrans2-en-indic-1B ^
    --output-dir ./openvino_models/indictrans2-en-indic-1B-fp16/optimum ^
    --device GPU --precision FP16
```

Output models are written to `backend/NMT/openvino_models/`.

---

### Frontend (`frontend/`)

```bat
cd frontend

REM Install npm packages
npm install

REM Copy Silero VAD + ONNX Runtime WASM assets to public/vad-assets
npm run copy-vad-assets

REM Start development server (http://localhost:5173)
npm run dev

REM -- or build a production bundle:
npm run build
```

> The `predev` and `prebuild` hooks run `copy-vad-assets` automatically, so a plain `npm run dev` is sufficient after the first install.

---

## Running the Application

Open **four separate terminals** and start each server:

```bat
REM Terminal 1 — ASR server (port 8002)
cd backend\STT
start_server.bat

REM Terminal 2 — NMT Indic->Indic server (port 8004)
cd backend\NMT
start_server_indic_indic.bat

REM Terminal 3 — NMT EN->Indic server (port 8003)  [optional]
cd backend\NMT
start_server_en_indic.bat

REM Terminal 4 — Frontend dev server (port 5173)
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Environment Variables

All variables are optional — defaults work out of the box for local development.

### STT server (`backend/STT/start_server.bat`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ASR_DEVICE` | `CPU` | OpenVINO device (`CPU`, `GPU`, `AUTO`) |
| `ASR_MODEL_DIR` | `openvino_models` | Path to converted OpenVINO ASR models |
| `ASR_CONFIG_PATH` | `conformer_model` | Path to IndicConformer config dir |
| `LOG_IO` | `1` | Print input audio size + output transcript per request (`0` to disable) |

### NMT servers (`backend/NMT/start_server_*.bat`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NMT_DEVICE` | `GPU` | OpenVINO device (`CPU`, `GPU`, `AUTO`) |
| `NMT_MODEL_DIR` | *(model-specific path)* | Path to converted OpenVINO NMT model |
| `NMT_MODEL_NAME` | *(HF model id)* | HuggingFace model name for tokenizer |
| `NMT_WARMUP` | `3` | Number of warmup inference passes at startup |
| `LOG_IO` | `1` | Print source + translated text per request (`0` to disable) |

---

## API Reference

Both backend servers follow the **Bhashini pipeline API** format.

### ASR — `POST http://localhost:8002/services/inference/pipeline`

**Request:**
```json
{
  "pipelineTasks": [{ "taskType": "asr", "config": { "language": { "sourceLanguage": "hi" } } }],
  "inputData": {
    "audio": [{ "audioContent": "<base64-encoded-float32-pcm>" }]
  }
}
```

**Response:**
```json
{
  "pipelineResponse": [{ "taskType": "asr", "output": [{ "source": "नमस्ते दुनिया" }] }]
}
```

### NMT — `POST http://localhost:8004/services/inference/pipeline`

**Batch request (used by the frontend):**
```json
{
  "pipelineTasks": [{ "taskType": "translation", "config": { "language": { "sourceLanguage": "hi" } } }],
  "inputData": {
    "requests": [
      { "source": "नमस्ते दुनिया", "targetLanguage": "ta" },
      { "source": "नमस्ते दुनिया", "targetLanguage": "bn" }
    ]
  }
}
```

**Response:**
```json
{
  "pipelineResponse": [{
    "taskType": "translation",
    "output": [
      { "source": "नमस्ते दुनिया", "target": "வணக்கம் உலகம்", "targetLanguage": "ta" },
      { "source": "नमस्ते दुनिया", "target": "হ্যালো বিশ্ব", "targetLanguage": "bn" }
    ]
  }]
}
```

Health check endpoints: `GET /health` on each server.

---

## Supported Languages

| Code | Language | ASR | NMT |
|------|----------|-----|-----|
| `hi` | Hindi | ✓ | ✓ |
| `bn` | Bengali | ✓ | ✓ |
| `ta` | Tamil | ✓ | ✓ |
| `te` | Telugu | ✓ | ✓ |
| `kn` | Kannada | ✓ | ✓ |
| `ml` | Malayalam | ✓ | ✓ |
| `mr` | Marathi | ✓ | ✓ |
| `gu` | Gujarati | ✓ | ✓ |
| `pa` | Punjabi | ✓ | ✓ |
| `or` | Odia | ✓ | ✓ |
| `as` | Assamese | ✓ | ✓ |
| `ur` | Urdu | ✓ | ✓ |
| `en` | English | — | Source only (EN→Indic server) |

---

## Further Reading

- [OpenVINO Documentation](https://docs.openvino.ai/)
- [OpenVINO Model Optimization Guide](https://docs.openvino.ai/2024/openvino-workflow/model-optimization.html)
- [IndicTrans2 Paper](https://arxiv.org/abs/2305.16307)
- [IndicConformer / AI4Bharat](https://github.com/AI4Bharat/)
