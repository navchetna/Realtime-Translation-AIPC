# OpenAI-Compatible Whisper ASR API

This directory contains an OpenAI-compatible Automatic Speech Recognition (ASR) API server using OpenVINO GenAI's Whisper implementation.

## Features

- ✅ OpenAI Whisper API compatible endpoints
- ✅ Transcription (audio to text in original language)
- ✅ Translation (audio to English text)
- ✅ Multiple response formats (JSON, text, SRT, VTT, verbose JSON)
- ✅ Language specification support
- ✅ OpenVINO acceleration (CPU/GPU)
- ✅ Legacy API endpoint (backward compatibility)
- ✅ Multiple audio formats support (WAV, MP3, FLAC, OGG, etc.)

## Quick Start

### 1. Setup

Run the setup script to create the environment and install dependencies:

```bash
./setup.sh
```

This will:
- Create a Python virtual environment in `./venv`
- Install all dependencies including OpenVINO GenAI
- Optionally download the Whisper model

**Note:** The model will be automatically downloaded on first use if not pre-downloaded.

### 2. Start the Server

```bash
./start_server.sh
```

Or on Windows:
```cmd
start_server.bat
```

The server will start on `http://0.0.0.0:8001`

### 3. Test the API

Using curl:
```bash
# Transcribe audio
curl -X POST http://localhost:8001/v1/audio/transcriptions \
  -F "file=@demo_voice.wav" \
  -F "model=whisper-1" \
  -F "language=en"

# Translate to English
curl -X POST http://localhost:8001/v1/audio/translations \
  -F "file=@demo_voice.wav" \
  -F "model=whisper-1"
```

Using Python:
```python
import requests

# Transcribe
with open("demo_voice.wav", "rb") as f:
    response = requests.post(
        "http://localhost:8001/v1/audio/transcriptions",
        files={"file": f},
        data={"model": "whisper-1", "language": "en"}
    )
    print(response.json())
```

## Configuration

### Environment Variables

Configure the server by setting environment variables before running `start_server.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8001` | Server port |
| `ASR_DEVICE` | `GPU` | OpenVINO device (CPU, GPU, AUTO) |
| `ASR_MODEL_NAME` | `openvino/whisper-base` | Model name or path |
| `LOG_IO` | `1` | Log input/output (1=enabled, 0=disabled) |

Example:
```bash
export PORT=8080
export ASR_DEVICE=CPU
export ASR_MODEL_NAME=openvino/whisper-large
./start_server.sh
```

## API Endpoints

### POST /v1/audio/transcriptions

Transcribes audio into the input language (OpenAI compatible).

**Form Parameters:**
- `file` (file, required): Audio file to transcribe
- `model` (string): Model to use (e.g., "whisper-1")
- `language` (string, optional): Language code (e.g., "en", "es", "fr")
- `prompt` (string, optional): Optional text to guide the model
- `response_format` (string): Response format (json, text, srt, verbose_json, vtt)
- `temperature` (float): Sampling temperature (0.0 to 1.0)

**Response Formats:**
- `json` (default): `{"text": "transcription"}`
- `text`: Plain text transcription
- `verbose_json`: Includes task, language, duration, and text
- `srt`: SubRip subtitle format
- `vtt`: WebVTT subtitle format

**Example:**
```bash
curl -X POST http://localhost:8001/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=en" \
  -F "response_format=json"
```

### POST /v1/audio/translations

Translates audio into English (OpenAI compatible).

**Form Parameters:**
- `file` (file, required): Audio file to translate
- `model` (string): Model to use
- `prompt` (string, optional): Optional text to guide the model
- `response_format` (string): Response format (json, text)
- `temperature` (float): Sampling temperature

**Example:**
```bash
curl -X POST http://localhost:8001/v1/audio/translations \
  -F "file=@audio.wav" \
  -F "model=whisper-1"
```

### POST /services/inference/pipeline

Legacy pipeline endpoint for backward compatibility.

**Request Body:**
```json
{
  "pipelineTasks": [{
    "taskType": "asr",
    "config": {
      "language": {
        "sourceLanguage": "en"
      },
      "samplingRate": 16000
    }
  }],
  "inputData": {
    "audio": [{
      "audioContent": "base64_encoded_audio"
    }]
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "device": "GPU",
  "model": "openvino/whisper-base"
}
```

## Supported Languages

Whisper supports 99+ languages including:

| Code | Language | Code | Language | Code | Language |
|------|----------|------|----------|------|----------|
| `en` | English | `es` | Spanish | `fr` | French |
| `de` | German | `it` | Italian | `pt` | Portuguese |
| `ru` | Russian | `ja` | Japanese | `ko` | Korean |
| `zh` | Chinese | `ar` | Arabic | `hi` | Hindi |
| `tr` | Turkish | `pl` | Polish | `nl` | Dutch |
| `sv` | Swedish | `da` | Danish | `fi` | Finnish |
| `no` | Norwegian | `cs` | Czech | `ro` | Romanian |

And many more... Use ISO 639-1 language codes.

## Supported Audio Formats

- WAV (PCM, ADPCM)
- MP3
- FLAC
- OGG/Vorbis
- OGG/Opus
- M4A/AAC
- WebM
- Raw PCM (Float32)

## Available Models

Models from OpenVINO Model Zoo:

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `openvino/whisper-tiny` | ~40MB | Fastest | Lowest |
| `openvino/whisper-base` | ~150MB | Fast | Good |
| `openvino/whisper-small` | ~500MB | Medium | Better |
| `openvino/whisper-medium` | ~1.5GB | Slow | Great |
| `openvino/whisper-large` | ~3GB | Slowest | Best |
| `OpenVINO/distil-whisper-large-v3-int4-ov` | ~1GB | Fast | Excellent |

**Recommended:**
- For real-time: `openvino/whisper-base`
- For accuracy: `openvino/whisper-large`
- For balanced: `OpenVINO/distil-whisper-large-v3-int4-ov` (quantized)

## Performance Tuning

### Device Selection

- **CPU**: Works everywhere, moderate speed
- **GPU**: Requires Intel GPU or dedicated GPU, much faster
- **AUTO**: Automatically selects best device

Example for GPU:
```bash
export ASR_DEVICE=GPU
./start_server.sh
```

### Model Selection

Smaller models are faster but less accurate:
```bash
export ASR_MODEL_NAME=openvino/whisper-base  # Fast
export ASR_MODEL_NAME=openvino/whisper-large  # Accurate
```

### Quantized Models

For best performance, use INT4 quantized models:
```bash
export ASR_MODEL_NAME=OpenVINO/distil-whisper-large-v3-int4-ov
```

## Troubleshooting

### Model not loading
- Check that OpenVINO GenAI is installed: `pip show openvino-genai`
- Verify the model name or path is correct
- Check internet connection (for auto-download)

### GPU not detected
Ensure OpenVINO GPU support is installed:
```bash
pip install openvino[gpu]
```

### Slow inference
Try these options:
1. Use GPU: `export ASR_DEVICE=GPU`
2. Use smaller model: `export ASR_MODEL_NAME=openvino/whisper-base`
3. Use quantized model: `export ASR_MODEL_NAME=OpenVINO/distil-whisper-large-v3-int4-ov`

### Audio format not supported
Install additional audio codecs:
```bash
pip install soundfile librosa
```

## Development

### Project Structure
```
ASR/
├── server.py              # FastAPI server (OpenAI-compatible)
├── requirements.txt       # Dependencies
├── setup.sh              # Setup script
├── start_server.sh       # Server startup script (bash)
├── start_server.bat      # Server startup script (Windows)
├── README_API.md         # This file
├── demo_voice.wav        # Demo audio file
└── venv/                 # Virtual environment (created by setup)
```

### Testing

Test with the included demo audio:
```bash
curl -X POST http://localhost:8001/v1/audio/transcriptions \
  -F "file=@demo_voice.wav" \
  -F "model=whisper-1" \
  -F "language=en"
```

### Integration

Example Python client:
```python
import requests

def transcribe_audio(file_path, language="en"):
    with open(file_path, "rb") as f:
        response = requests.post(
            "http://localhost:8001/v1/audio/transcriptions",
            files={"file": f},
            data={
                "model": "whisper-1",
                "language": language,
                "response_format": "json"
            }
        )
    return response.json()["text"]

# Usage
text = transcribe_audio("audio.wav", language="en")
print(text)
```

Example JavaScript client:
```javascript
async function transcribeAudio(file, language = "en") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");
    formData.append("language", language);

    const response = await fetch("http://localhost:8001/v1/audio/transcriptions", {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    return data.text;
}
```

## Migration from Legacy API

If you're using the legacy pipeline endpoint, you can migrate to OpenAI-compatible endpoints:

**Before (Legacy):**
```python
response = requests.post(
    "http://localhost:8001/services/inference/pipeline",
    json={
        "pipelineTasks": [{
            "taskType": "asr",
            "config": {
                "language": {"sourceLanguage": "en"},
                "samplingRate": 16000
            }
        }],
        "inputData": {
            "audio": [{"audioContent": base64_audio}]
        }
    }
)
text = response.json()["pipelineResponse"][0]["output"][0]["source"]
```

**After (OpenAI-compatible):**
```python
response = requests.post(
    "http://localhost:8001/v1/audio/transcriptions",
    files={"file": audio_file},
    data={"model": "whisper-1", "language": "en"}
)
text = response.json()["text"]
```

## License

This implementation uses:
- OpenVINO GenAI (Apache 2.0)
- OpenAI Whisper (MIT)
- FastAPI (MIT)
