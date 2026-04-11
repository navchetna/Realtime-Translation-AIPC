# Real-time Multi-lingual Translation Demo

A high-performance, real-time application for translating continuous speech into multiple Indic languages simultaneously. This project harnesses advanced AI models for Speech-to-Text (STT) and Neural Machine Translation (NMT), running optimally on Intel hardware using **OpenVINO** inference engines.

## Features
- **Real-Time Speech Capture**: Natively monitors and intercepts voice pauses utilizing client-side AudioContext VAD (Voice Activity Detection).
- **Indic Conformer ASR**: Processes audio dynamically directly through raw PCM float memory buffers to accelerate performance without file I/O overhead.
- **Tri-Panel Machine Translation**: Instantaneously translates the transcribed text into 3 different configurable Indic languages (e.g., Hindi, Tamil, Bengali).
- **Intel-Themed Minimalist UI**: Sleek, glass-morphism aesthetic equipped with dynamic status tracking.

## Architecture & Models

This solution relies on models heavily optimized by Intel's OpenVINO toolkit for high-efficiency edge execution across Intel CPUs and GPUs.

- **STT (Speech-to-Text)**: [Indic Conformer ASR](https://github.com/AI4Bharat/IndicWav2Vec)
  - Loads 27 sub-models to handle seamless native CTC processing of 22 different Indic languages. 
- **NMT (Machine Translation)**: [IndicTrans2](https://github.com/AI4Bharat/IndicTrans2)
  - Employs a 1B parameter FP16/FP32 optimized model for extremely diverse Indic-to-Indic language machine translation.

### OpenVINO Optimization
These models bypass heavier frameworks like PyTorch during standard inference. They operate directly on the **OpenVINO Runtime engine** leveraging Native Preprocessing and device-specific optimizations (`FP32`/`FP16` mapping on integrated GPUs and NPUs).

For further learning regarding optimizing and converting models:
- [OpenVINO Documentation](https://docs.openvino.ai/)
- [OpenVINO Model Optimization Guide](https://docs.openvino.ai/2024/openvino-workflow/model-optimization.html)

---

## Setup & Running the Application

### 1. Prerequisites
- **Node.js**: (v18+) for the Frontend.
- **Python**: (3.10+) for the Backend servers.
- **OpenVINO**: Pre-installed pip requirements.

### 2. Frontend Initialization
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your environment variables (copy `.env.example` over to `.env`):
   ```bash
   cp .env.example .env
   ```
4. Start the frontend Vite Server:
   ```bash
   npm run dev
   ```

### 3. Backend Setup (STT & NMT)
The backend is split into two servers to handle Bhashini-compatible configurations.

#### Speech-to-Text (STT) Server
1. Navigate to the `backend/STT` directory.
2. Activate your virtual environment and install requirements (e.g., `pip install -r requirements.txt`).
3. Download/place the `openvino_models` into the directory as per the scripts.
4. Run the Uvicorn server (Default port: `8000` or `8002`):
   ```bash
   python server.py
   # Or use the start_server.bat on Windows
   ```

#### Neural Machine Translation (NMT) Server
1. Navigate to the `backend/NMT` directory.
2. Activate your virtual environment.
3. Start the Inference Server (Default port: `8004`):
   ```bash
   python server_indic_indic.py
   ```

### 4. Usage
Once all servers are running, access the web client at `http://localhost:5173`. Select your microphone and click **Start Listening**. Speech pauses will automatically trigger the pipeline.
