import base64
import logging
import os
import tempfile
import io
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from openvino_inference_optimized import IndicASROpenVINOOptimized

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set LOG_IO=0 to suppress per-request input/output logging. Default: enabled.
LOG_IO = os.getenv("LOG_IO", "1").strip() not in ("0", "false", "no", "off")

# --- Pydantic models for Bhashini pipeline request/response ---


class LanguageConfig(BaseModel):
    sourceLanguage: str
    sourceScriptCode: str | None = None


class TaskConfig(BaseModel):
    language: LanguageConfig
    serviceId: str | None = None
    postProcessors: list[str] | None = None
    preProcessors: list[str] | None = None
    samplingRate: int | None = None


class PipelineTask(BaseModel):
    taskType: str
    config: TaskConfig


class AudioInputItem(BaseModel):
    audioContent: str | None = None
    audioUri: str | None = None


class InputData(BaseModel):
    audio: list[AudioInputItem] | None = None


class PipelineRequest(BaseModel):
    pipelineTasks: list[PipelineTask]
    inputData: InputData


class OutputItem(BaseModel):
    source: str


class PipelineResponseItem(BaseModel):
    taskType: str
    config: dict | None = None
    output: list[OutputItem] | None = None
    audio: list | None = None
    metrics: dict | None = None


class PipelineResponse(BaseModel):
    pipelineResponse: list[PipelineResponseItem]


# --- App setup ---

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="IndicConformer ASR API (Bhashini-compatible)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

asr_model: IndicASROpenVINOOptimized | None = None


@app.on_event("startup")
def load_model():
    """Load the IndicConformer model at startup."""
    global asr_model

    device = os.getenv("ASR_DEVICE", "GPU")
    model_dir = os.getenv("ASR_MODEL_DIR", "openvino_models")
    config_path = os.getenv("ASR_CONFIG_PATH", "conformer_model/")

    logger.info(f"Loading IndicConformer model from '{model_dir}' on {device}...")
    try:
        asr_model = IndicASROpenVINOOptimized(
            model_dir=model_dir,
            config_path=config_path,
            device=device,
        )
        langs = asr_model.get_supported_languages()
        logger.info(f"Successfully loaded IndicConformer with {len(langs)} languages")
    except Exception:
        logger.exception("Failed to load IndicConformer model")


def _transcribe(audio_bytes: bytes, lang: str) -> str:
    """Run ASR inference on audio bytes and return transcribed text."""
    import numpy as np
    import soundfile as sf
    
    audio_buffer: np.ndarray

    # Preferred path: frontend sends raw Float32 PCM bytes (16kHz mono).
    if len(audio_bytes) % 4 == 0:
        audio_buffer = np.frombuffer(audio_bytes, dtype=np.float32)
    else:
        # Fallback path: decode encoded audio files (wav/webm/etc) if provided.
        waveform, sr = sf.read(io.BytesIO(audio_bytes), dtype='float32')
        if waveform.ndim > 1:
            waveform = np.mean(waveform, axis=1)
        if sr != 16000:
            import librosa
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=16000, res_type='kaiser_fast')
        audio_buffer = waveform.astype(np.float32, copy=False)

    if audio_buffer.size == 0:
        raise ValueError("Received empty audio payload")

    # Guarantee finite values for librosa to avoid ParameterError.
    audio_buffer = np.nan_to_num(audio_buffer, nan=0.0, posinf=0.0, neginf=0.0)

    # Clamp to normalized PCM range and ensure contiguous float32 array.
    audio_buffer = np.clip(audio_buffer, -1.0, 1.0).astype(np.float32, copy=False)
    audio_buffer = np.ascontiguousarray(audio_buffer)

    try:
        text = asr_model.transcribe(audio_buffer, lang=lang, decoding="ctc")
        return text
    except Exception as e:
        logger.exception("Failed transcription")
        raise


@app.post("/services/inference/pipeline", response_model=PipelineResponse)
def inference_pipeline(request: PipelineRequest):
    if not request.pipelineTasks:
        raise HTTPException(status_code=400, detail="pipelineTasks is empty")

    task = request.pipelineTasks[0]

    if task.taskType != "asr":
        raise HTTPException(status_code=400, detail=f"Unsupported taskType: '{task.taskType}'. Only 'asr' is supported.")

    if asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    # Resolve language
    lang_code = task.config.language.sourceLanguage.lower()
    supported = asr_model.get_supported_languages()
    if lang_code not in supported:
        raise HTTPException(status_code=400, detail=f"Unsupported language: '{lang_code}'. Supported: {supported}")

    if not request.inputData.audio:
        raise HTTPException(status_code=400, detail="inputData.audio is empty")

    t_start = time.perf_counter()
    total_audio_duration_s = 0.0
    outputs = []
    for audio_input in request.inputData.audio:
        if audio_input.audioContent:
            audio_bytes = base64.b64decode(audio_input.audioContent)
        elif audio_input.audioUri:
            import urllib.request
            with urllib.request.urlopen(audio_input.audioUri) as resp:
                audio_bytes = resp.read()
        else:
            raise HTTPException(status_code=400, detail="Each audio item must have audioContent or audioUri")

        audio_bytes_len = len(audio_bytes)
        total_audio_duration_s += audio_bytes_len / (16000 * 4)
        if LOG_IO:
            logger.info(
                "[ASR  INPUT] lang=%s  audio_bytes=%d  (~%.2f s at 16kHz float32)",
                lang_code,
                audio_bytes_len,
                audio_bytes_len / (16000 * 4),
            )

        text = _transcribe(audio_bytes, lang_code)

        if LOG_IO:
            logger.info("[ASR OUTPUT] lang=%s  transcript=%r", lang_code, text)

        outputs.append(OutputItem(source=text))

    latency_s = time.perf_counter() - t_start
    rtf = round(latency_s / total_audio_duration_s, 3) if total_audio_duration_s > 0 else 0.0
    if LOG_IO:
        logger.info(
            "[ASR METRICS] latency=%.1fms  audio_dur=%.2fs  rtf=%.3f",
            latency_s * 1000, total_audio_duration_s, rtf,
        )

    return PipelineResponse(
        pipelineResponse=[
            PipelineResponseItem(
                taskType="asr",
                config=None,
                output=outputs,
                audio=None,
                metrics={
                    "latency_ms": round(latency_s * 1000, 1),
                    "audio_duration_s": round(total_audio_duration_s, 2),
                    "rtf": rtf,
                },
            )
        ]
    )


@app.get("/health")
def health():
    if asr_model is None:
        return {"status": "error", "detail": "Model not loaded"}
    info = asr_model.get_model_info()
    return {
        "status": "ok",
        "device": info["device"],
        "languages": info["languages"],
        "models_loaded": info["models_loaded"],
    }
