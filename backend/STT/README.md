# Whisper Speech to Text Service (OpenVINO GenAI)

## Setup

1. Create environment and install dependencies:
   ```bash
   uv venv --python=3.10
   .venv\Scripts\activate
   uv pip install -r requirements.txt
   ```

2. Download the quantized model:
    ```bash
    hf download OpenVINO/distil-whisper-large-v3-int4-ov --local-dir distil_whisper_large
    ```

3. Choose runtime variables (optional):
   ```bash
   set ASR_DEVICE=GPU
   set ASR_MODEL_NAME=distil_whisper_large
   ```

4. Run the server:
   ```bash
   start_server.bat
   ```

## API

- Endpoint: `POST /services/inference/pipeline`
- Task type: `asr`
- Input: base64 audio bytes (`inputData.audio[].audioContent`) or URL (`audioUri`)
- Output: `pipelineResponse[0].output[].source`

## Health

- Endpoint: `GET /health`