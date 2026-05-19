# OpenAI-Compatible TTS API Server

This directory contains an OpenAI-compatible Text-to-Speech API server using Supertonic TTS with OpenVINO backend.

## Features

- ✅ OpenAI TTS API compatible endpoints
- ✅ Multiple audio formats (MP3, WAV, OPUS, FLAC, AAC, PCM)
- ✅ Multiple voice styles
- ✅ OpenVINO acceleration (CPU/GPU)
- ✅ Multilingual support (32+ languages)
- ✅ Adjustable speed control
- ✅ FP16/FP32 precision options

## Quick Start

### 1. Setup

Run the setup script to create the environment, download models, and convert to OpenVINO format:

```bash
./setup.sh
```

This will:
- Create a Python virtual environment in `./venv`
- Install all dependencies
- Clone the Supertonic model repository
- Convert ONNX models to OpenVINO IR format

**Note:** The setup process may take 10-15 minutes depending on your internet connection.

### 2. Start the Server

```bash
./start_server.sh
```

The server will start on `http://0.0.0.0:8000`

### 3. Test the API

```bash
# Using curl
curl -X POST http://localhost:8000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "Hello, this is a test of the text to speech API!",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
  }' \
  --output speech.mp3

# Using Python
python test_api.py
```

## Configuration

### Environment Variables

Configure the server by setting environment variables before running `start_server.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `DEVICE` | `CPU` | OpenVINO device (CPU, GPU, AUTO) |
| `PRECISION` | `fp32` | Inference precision (fp16, fp32) |
| `DIFFUSION_STEPS` | `8` | Number of diffusion steps (higher = better quality, slower) |
| `MODEL_DIR` | `./ov_model_fp16` | OpenVINO models directory |
| `CONFIG_DIR` | `./supertonic-3/onnx` | Configuration files directory |
| `VOICE_STYLES_DIR` | `./supertonic-3/voice_styles` | Voice styles directory |
| `DEFAULT_VOICE` | `alloy` | Default voice name |
| `DEFAULT_LANGUAGE` | `en` | Default language code |

Example:
```bash
export PORT=8080
export DEVICE=GPU
export DIFFUSION_STEPS=12
./start_server.sh
```

## API Endpoints

### POST /v1/audio/speech

Creates audio from input text (OpenAI compatible).

**Request Body:**
```json
{
  "model": "tts-1",
  "input": "Text to synthesize",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0,
  "language": "en"
}
```

**Parameters:**
- `model` (string): Model to use (`tts-1` or `tts-1-hd`)
- `input` (string, required): Text to synthesize (max 4096 characters)
- `voice` (string): Voice to use (see available voices below)
- `response_format` (string): Audio format (`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`)
- `speed` (float): Speed multiplier (0.25 to 4.0)
- `language` (string): Language code (default: `en`)

**Response:**
- Returns audio file in requested format
- Content-Type: `audio/mpeg`, `audio/wav`, etc.

### GET /v1/voices

Lists available voices and supported languages.

**Response:**
```json
{
  "voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  "default_voice": "alloy",
  "supported_languages": ["en", "ko", "ja", "ar", ...]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "voices_loaded": 6,
  "device": "CPU"
}
```

## Available Voices

The API maps OpenAI voice names to available voice styles:
- `alloy` - Neutral, balanced voice
- `echo` - Clear, articulate voice
- `fable` - Expressive, storytelling voice
- `onyx` - Deep, authoritative voice
- `nova` - Warm, friendly voice
- `shimmer` - Bright, energetic voice

## Supported Languages

32+ languages supported including:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ja` - Japanese
- `ko` - Korean
- `ar` - Arabic
- `hi` - Hindi
- And many more...

See `/v1/voices` endpoint for full list.

## Response Formats

- `mp3` - MPEG Audio Layer III (recommended for web)
- `opus` - Opus in OGG container (best compression)
- `aac` - Advanced Audio Coding (good for mobile)
- `flac` - Free Lossless Audio Codec (best quality)
- `wav` - Waveform Audio File Format (uncompressed)
- `pcm` - Raw PCM 16-bit (no container)

## Performance Tuning

### Diffusion Steps
- `4-6 steps`: Fast, lower quality
- `8 steps`: Balanced (default)
- `12-16 steps`: High quality, slower

### Precision
- `fp16`: Faster, lower memory, slightly lower quality (GPU recommended)
- `fp32`: Slower, higher memory, best quality

### Device
- `CPU`: Works everywhere, moderate speed
- `GPU`: Requires Intel GPU or dedicated GPU, much faster
- `AUTO`: Automatically selects best device

Example for high-quality, GPU-accelerated:
```bash
export DEVICE=GPU
export PRECISION=fp32
export DIFFUSION_STEPS=12
./start_server.sh
```

## Troubleshooting

### Models not found
Run `./setup.sh` to download and convert models.

### Voice not found
Check available voices with:
```bash
curl http://localhost:8000/v1/voices
```

### Slow inference
Try these options:
1. Reduce diffusion steps: `export DIFFUSION_STEPS=6`
2. Use GPU: `export DEVICE=GPU`
3. Use FP16 precision: `export PRECISION=fp16`

### GPU not detected
Ensure OpenVINO GPU support is installed:
```bash
pip install openvino[gpu]
```

## Development

### Project Structure
```
TTS/
├── api_server.py              # FastAPI server
├── requirements_api.txt       # API dependencies
├── setup.sh                   # Setup script
├── start_server.sh           # Server startup script
├── test_api.py               # Test script
├── Supertonic/               # Supertonic TTS code
│   ├── inference.py          # OpenVINO inference
│   ├── convert_to_ov.py      # ONNX to OpenVINO converter
│   ├── helper.py             # Helper functions
│   └── requirements.txt      # Core dependencies
├── venv/                     # Virtual environment (created by setup)
├── supertonic-3/            # Model repository (downloaded by setup)
│   ├── onnx/                # ONNX models and configs
│   └── voice_styles/        # Voice style files
└── ov_model_fp16/           # Converted OpenVINO models (created by setup)
```

### Adding Custom Voices

1. Place voice style JSON files in `supertonic-3/voice_styles/`
2. Restart the server
3. Voices will be automatically loaded and assigned names

## License

This implementation uses:
- Supertonic TTS (check Supertonic license)
- OpenVINO (Apache 2.0)
- FastAPI (MIT)
