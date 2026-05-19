# Voice-to-Voice System - Complete Setup Guide

This guide will help you set up the entire Voice-to-Voice system, including all backend services (ASR, TTS, LLM) and the frontend application.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Manual Setup](#manual-setup)
- [Starting Services](#starting-services)
- [Troubleshooting](#troubleshooting)
- [System Architecture](#system-architecture)

---

## 🎯 Prerequisites

Before running the setup, ensure you have the following installed:

### Required Software

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Check: `node --version`

2. **Python** (3.8 or higher, 3.12 recommended)
   - Download: https://www.python.org/
   - Check: `python --version`

3. **Git** (optional, for cloning)
   - Download: https://git-scm.com/
   - Check: `git --version`

### Optional (Recommended)

4. **UV Package Manager** (faster Python package installation)
   - Install: `pip install uv`
   - Much faster than pip for large packages

### System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 8GB minimum, 16GB+ recommended
- **Storage**: 10GB+ free space for models
- **GPU**: Optional (Intel GPU for TTS/LLM acceleration)

---

## 🚀 Quick Start

### One-Command Setup (Recommended)

```batch
setup_services.bat
```

This single command will:
1. ✅ Install frontend dependencies and build
2. ✅ Set up ASR environment and download models
3. ✅ Set up TTS environment, download models, and convert to OpenVINO
4. ✅ Set up LLM environment and download models

**Estimated Time**: 15-30 minutes (depending on internet speed)

**What it does:**
- Creates isolated Python virtual environments for each service
- Installs all required Python packages
- Downloads AI models from HuggingFace
- Converts models to optimized formats (OpenVINO)
- Builds the frontend application

---

## 📖 Detailed Setup

### Step-by-Step Installation

If you prefer to set up services individually or if the automated setup fails:

#### 1. Frontend Setup

```batch
cd frontend
npm install
npm run build
```

**What it does:**
- Installs React/Next.js dependencies
- Builds production-ready frontend

#### 2. ASR (Automatic Speech Recognition) Setup

```batch
cd backend\ASR
setup.bat
```

**What it does:**
- Creates `.venv` virtual environment
- Installs ASR dependencies (OpenVINO, etc.)
- Downloads speech recognition models
- Configures ASR server

#### 3. TTS (Text-to-Speech) Setup

```batch
cd backend\TTS
setup.bat
```

**What it does:**
- Creates `.venv` virtual environment
- Installs TTS dependencies (OpenVINO GenAI, etc.)
- Downloads Supertonic TTS models from HuggingFace
- Converts ONNX models to OpenVINO IR format (FP16)
- Configures TTS server

**Note**: TTS setup takes longest due to large model downloads (~1-2GB)

#### 4. LLM (Large Language Model) Setup

```batch
cd backend\LLM
setup.bat
```

**What it does:**
- Creates `.venv` virtual environment
- Installs LLM dependencies (OpenVINO GenAI, etc.)
- Downloads LFM2.5-350M model from HuggingFace
- Configures LLM server with OpenAI-compatible API

---

## 🔧 Manual Setup

If you need more control or want to customize the setup:

### Frontend (Manual)

```batch
cd frontend

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

### ASR (Manual)

```batch
cd backend\ASR

# Create virtual environment
python -m venv .venv
# or faster: uv venv .venv --python=3.12

# Activate
call .venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
# or faster: uv pip install -r requirements.txt

# Download models (automatic on first run)
python download_models.py

# Start server
python server.py
```

### TTS (Manual)

```batch
cd backend\TTS

# Create virtual environment
python -m venv .venv
# or faster: uv venv .venv --python=3.12

# Activate
call .venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
# or faster: uv pip install -r requirements.txt

# Clone model repository
git clone https://huggingface.co/Supertone/supertonic-3

# Convert models to OpenVINO
python convert_to_openvino.py --precision fp16

# Start server
python api_server.py
```

### LLM (Manual)

```batch
cd backend\LLM

# Create virtual environment
python -m venv .venv
# or faster: uv venv .venv --python=3.12

# Activate
call .venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
# or faster: uv pip install -r requirements.txt

# Download model (automatic on first run)
python -c "import huggingface_hub as hf; hf.snapshot_download('OpenVINO/LFM2.5-350M-fp16-ov', local_dir='LFM2.5-350M-fp16-ov')"

# Start server
python server.py
```

---

## ▶️ Starting Services

After successful setup, start each service:

### Start All Services (in separate terminals)

**Terminal 1 - Frontend:**
```batch
cd frontend
npm run dev
```
Access at: http://localhost:3000

**Terminal 2 - ASR:**
```batch
cd backend\ASR
start_server.bat
```
API at: http://localhost:8001

**Terminal 3 - TTS:**
```batch
cd backend\TTS
start_server.bat
```
API at: http://localhost:8000

**Terminal 4 - LLM:**
```batch
cd backend\LLM
start_server.bat
```
API at: http://localhost:8000 (or configure different port)

### Quick Start Scripts

Each service has a convenient startup script:

```batch
# Frontend
cd frontend && npm run dev

# ASR
cd backend\ASR && start_server.bat

# TTS
cd backend\TTS && start_server.bat

# LLM
cd backend\LLM && start_server.bat
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Python Not Found

**Error**: `python is not recognized as an internal or external command`

**Solution**:
- Install Python from https://python.org/
- During installation, check "Add Python to PATH"
- Restart terminal after installation

#### 2. Node.js Not Found

**Error**: `node is not recognized as an internal or external command`

**Solution**:
- Install Node.js from https://nodejs.org/
- Choose LTS version
- Restart terminal after installation

#### 3. Model Download Fails

**Error**: `Failed to download model` or connection timeout

**Solution**:
```batch
# Check internet connection
ping huggingface.co

# Manually download using Python
cd backend\[SERVICE]
call .venv\Scripts\activate.bat
python download_model.py

# Or use HF CLI
huggingface-cli download MODEL_ID
```

#### 4. Out of Disk Space

**Error**: `No space left on device` or similar

**Solution**:
- Models require ~10GB total
- Clear space on C: drive
- Check `%USERPROFILE%\.cache\huggingface` for cached models
- Delete old model versions if needed

#### 5. OpenVINO Conversion Fails

**Error**: `ovc command not found` or conversion errors

**Solution**:
```batch
cd backend\TTS
call .venv\Scripts\activate.bat

# Reinstall OpenVINO
pip uninstall openvino openvino-dev
pip install openvino openvino-dev

# Try conversion again
python convert_to_openvino.py --precision fp16
```

#### 6. Port Already in Use

**Error**: `Address already in use` or port conflict

**Solution**:
```batch
# Check what's using the port
netstat -ano | findstr :8000

# Kill the process
taskkill /PID [process_id] /F

# Or change port in .env file
set PORT=8080
```

#### 7. Virtual Environment Issues

**Error**: Virtual environment activation fails

**Solution**:
```batch
# Delete and recreate
cd backend\[SERVICE]
rmdir /s /q .venv
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
```

### Getting Help

If you encounter issues not listed here:

1. Check service-specific README files:
   - `backend/ASR/README.md`
   - `backend/TTS/README.md`
   - `backend/LLM/README.md`

2. Check logs in each service directory

3. Run health checks:
   ```batch
   curl http://localhost:8000/health  # TTS
   curl http://localhost:8001/health  # ASR
   curl http://localhost:8000/health  # LLM
   ```

4. Verify dependencies:
   ```batch
   python --version
   node --version
   npm --version
   pip --version
   ```

---

## 🏗️ System Architecture

### Directory Structure

```
Voice-to-Voice/
├── frontend/                 # React/Next.js frontend
│   ├── package.json
│   ├── src/
│   └── public/
│
├── backend/
│   ├── ASR/                 # Speech Recognition Service
│   │   ├── .venv/          # Python virtual environment
│   │   ├── models/         # Downloaded ASR models
│   │   ├── server.py       # FastAPI server
│   │   ├── setup.bat       # Setup script
│   │   └── start_server.bat
│   │
│   ├── TTS/                 # Text-to-Speech Service
│   │   ├── .venv/          # Python virtual environment
│   │   ├── supertonic-3/   # TTS model files
│   │   ├── ov_model_fp16/  # OpenVINO converted models
│   │   ├── api_server.py   # FastAPI server
│   │   ├── setup.bat       # Setup script
│   │   └── start_server.bat
│   │
│   └── LLM/                 # Language Model Service
│       ├── .venv/          # Python virtual environment
│       ├── LFM2.5-350M-fp16-ov/  # LLM model files
│       ├── server.py       # FastAPI server
│       ├── models.py       # Pydantic models
│       ├── utils.py        # Utility functions
│       ├── setup.bat       # Setup script
│       └── start_server.bat
│
└── setup_services.bat       # Master setup script
```

### Service Ports

| Service | Default Port | API Docs |
|---------|-------------|----------|
| Frontend | 3000 | http://localhost:3000 |
| ASR | 8001 | http://localhost:8001/docs |
| TTS | 8000 | http://localhost:8000/docs |
| LLM | 8000* | http://localhost:8000/docs |

*Configure different port if running with TTS

### Technology Stack

**Frontend:**
- React / Next.js
- TypeScript
- Tailwind CSS

**Backend Services:**
- **ASR**: FastAPI + OpenVINO (Whisper/Conformer models)
- **TTS**: FastAPI + OpenVINO GenAI (Supertonic TTS)
- **LLM**: FastAPI + OpenVINO GenAI (LFM2.5)

**Optimization:**
- OpenVINO IR format for CPU/GPU acceleration
- FP16 precision for smaller models and faster inference
- Asynchronous API endpoints

---

## 📊 Model Information

### ASR Models
- **Model**: Whisper / Indic-Conformer
- **Size**: ~500MB - 1GB
- **Languages**: Multiple (English, Hindi, etc.)
- **Format**: ONNX → OpenVINO IR

### TTS Models
- **Model**: Supertonic-3
- **Size**: ~400MB (OpenVINO FP16)
- **Languages**: 30+ languages
- **Format**: ONNX → OpenVINO IR (FP16)

### LLM Models
- **Model**: LFM2.5-350M
- **Size**: ~700MB (FP16)
- **Format**: OpenVINO IR (FP16)
- **Context**: 2048 tokens

---

## 🚀 Performance Tips

1. **Use UV for faster package installation**:
   ```batch
   pip install uv
   uv pip install -r requirements.txt  # 10x faster than pip
   ```

2. **Use Intel GPU if available**:
   ```batch
   # In .env files, set:
   DEVICE=GPU
   ```

3. **Reduce model precision** for faster inference:
   - Use FP16 models (default)
   - FP32 only if accuracy issues occur

4. **Optimize batch sizes** based on available RAM

5. **Use SSD** for model storage (faster loading)

---

## 🎓 Next Steps

After setup is complete:

1. **Test each service individually**
2. **Check API documentation** at `/docs` endpoints
3. **Configure environment variables** in `.env` files
4. **Run integration tests**
5. **Start building your application**

---

## 📄 License

See individual component licenses for details.

---

**Setup completed?** Start your Voice-to-Voice journey! 🎉
