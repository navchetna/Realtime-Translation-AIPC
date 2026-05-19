#!/usr/bin/env python3
"""
OpenAI-compatible Whisper ASR API Server
Provides OpenAI Whisper API compatible endpoints using OpenVINO GenAI
"""

import base64
import io
import logging
import os
import time
import urllib.request
from typing import Optional

import numpy as np
import openvino_genai as ov_genai
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

LOG_IO = os.getenv("LOG_IO", "1").strip().lower() not in ("0", "false", "no", "off")


class Whisper:
    """OpenVINO Whisper ASR Pipeline"""

    def __init__(self, model_name: str, device: str = "GPU"):
        logger.info(f"Initializing Whisper pipeline: model={model_name}, device={device}")
        self.pipeline = ov_genai.WhisperPipeline(model_name, device=device)
        self.tokenizer = self.pipeline.get_tokenizer()
        logger.info("Whisper pipeline loaded successfully")

    @staticmethod
    def convert_bytes_to_array(audio_bytes: bytes, fallback_sr: int = 16000):
        """Convert audio bytes to numpy array"""
        try:
            # Try standard container decoding first (wav/flac/ogg/mp3/etc.)
            audio_stream = io.BytesIO(audio_bytes)
            audio_array, sr = sf.read(file=audio_stream, dtype="float32")
            return audio_array, sr
        except sf.LibsndfileError:
            # Frontend streams raw Float32 PCM bytes from VAD; decode directly
            if len(audio_bytes) % 4 != 0:
                raise ValueError("Raw Float32 audio payload size must be divisible by 4 bytes")
            audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
            return audio_array, int(fallback_sr)

    def generate(
        self,
        audio_array: np.ndarray,
        language: Optional[str] = None,
        task: str = "transcribe",
        return_timestamps: bool = False,
        temperature: float = 0.0
    ) -> str:
        """Generate transcription or translation"""
        # Prepare language token if specified
        lang_token = None
        if language:
            lang_token = self._language_to_whisper_token(language)

        transcription = self.pipeline.generate(
            audio_array,
            task=task,
            return_timestamps=return_timestamps,
            language=lang_token,
        )
        return str(transcription)

    @staticmethod
    def _language_to_whisper_token(lang_code: str) -> str:
        """Convert language code to Whisper token format"""
        lang = (lang_code or "en").strip().lower()

        # Common language mappings
        mapping = {
            "en": "<|en|>",
            "english": "<|en|>",
            "es": "<|es|>",
            "spanish": "<|es|>",
            "fr": "<|fr|>",
            "french": "<|fr|>",
            "de": "<|de|>",
            "german": "<|de|>",
            "it": "<|it|>",
            "italian": "<|it|>",
            "pt": "<|pt|>",
            "portuguese": "<|pt|>",
            "ru": "<|ru|>",
            "russian": "<|ru|>",
            "ja": "<|ja|>",
            "japanese": "<|ja|>",
            "ko": "<|ko|>",
            "korean": "<|ko|>",
            "zh": "<|zh|>",
            "chinese": "<|zh|>",
            "ar": "<|ar|>",
            "arabic": "<|ar|>",
            "hi": "<|hi|>",
            "hindi": "<|hi|>",
        }

        # If exact match found
        if lang in mapping:
            return mapping[lang]

        # Try to format as Whisper token if not found
        # Remove any existing brackets
        lang_clean = lang.replace("<|", "").replace("|>", "")
        return f"<|{lang_clean}|>"


# OpenAI API Models
class TranscriptionResponse(BaseModel):
    """OpenAI transcription response"""
    text: str


class VerboseTranscriptionResponse(BaseModel):
    """OpenAI verbose transcription response"""
    task: str
    language: str
    duration: float
    text: str


# Legacy API Models (for backward compatibility)
class LanguageConfig(BaseModel):
    sourceLanguage: str
    sourceScriptCode: Optional[str] = None


class TaskConfig(BaseModel):
    language: LanguageConfig
    serviceId: Optional[str] = None
    postProcessors: Optional[list[str]] = None
    preProcessors: Optional[list[str]] = None
    samplingRate: Optional[int] = None


class PipelineTask(BaseModel):
    taskType: str
    config: TaskConfig


class AudioInputItem(BaseModel):
    audioContent: Optional[str] = None
    audioUri: Optional[str] = None


class InputData(BaseModel):
    audio: Optional[list[AudioInputItem]] = None


class PipelineRequest(BaseModel):
    pipelineTasks: list[PipelineTask]
    inputData: InputData


class OutputItem(BaseModel):
    source: str


class PipelineResponseItem(BaseModel):
    taskType: str
    config: Optional[dict] = None
    output: Optional[list[OutputItem]] = None
    audio: Optional[list] = None
    metrics: Optional[dict] = None


class PipelineResponse(BaseModel):
    pipelineResponse: list[PipelineResponseItem]


# FastAPI App
app = FastAPI(
    title="OpenAI-Compatible Whisper ASR API",
    description="Speech-to-Text API compatible with OpenAI's Whisper endpoint",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

asr_model: Optional[Whisper] = None


@app.on_event("startup")
def load_model():
    """Load Whisper model on startup"""
    global asr_model

    device = os.getenv("ASR_DEVICE", "GPU")
    model_name = os.getenv("ASR_MODEL_NAME", "openvino/whisper-base")

    logger.info("=" * 70)
    logger.info("Initializing Whisper ASR API Server")
    logger.info("=" * 70)
    logger.info(f"Model: {model_name}")
    logger.info(f"Device: {device}")
    logger.info("=" * 70)

    try:
        asr_model = Whisper(model_name=model_name, device=device)
        logger.info("=" * 70)
        logger.info("Whisper ASR API Server ready")
        logger.info("=" * 70)
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}", exc_info=True)
        raise


def _transcribe_audio(
    audio_bytes: bytes,
    language: Optional[str] = None,
    task: str = "transcribe",
    response_format: str = "json",
    temperature: float = 0.0
) -> tuple[str, float, str]:
    """Internal transcription function"""
    if asr_model is None:
        raise RuntimeError("ASR model not loaded")

    # Convert audio bytes to array
    audio_array, sr = asr_model.convert_bytes_to_array(audio_bytes, fallback_sr=16000)

    # Convert to mono if stereo
    if getattr(audio_array, "ndim", 1) > 1:
        audio_array = audio_array.mean(axis=1)

    if len(audio_array) == 0:
        raise ValueError("Received empty audio payload")

    # Calculate audio duration
    audio_duration_s = float(len(audio_array)) / float(sr) if sr else 0.0

    # Generate transcription
    text = asr_model.generate(
        audio_array,
        language=language,
        task=task,
        return_timestamps=False,
        temperature=temperature
    )

    # Detect language if not specified
    detected_language = language if language else "en"

    return text, audio_duration_s, detected_language


# OpenAI-Compatible Endpoints

@app.post("/v1/audio/transcriptions")
async def create_transcription(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    language: Optional[str] = Form(default=None),
    prompt: Optional[str] = Form(default=None),
    response_format: str = Form(default="json"),
    temperature: float = Form(default=0.0)
):
    """
    OpenAI-compatible transcription endpoint

    Transcribes audio into the input language.
    """
    if asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    try:
        # Read audio file
        audio_bytes = await file.read()

        if LOG_IO:
            logger.info(f"[TRANSCRIPTION] file={file.filename}, size={len(audio_bytes)}, lang={language}, format={response_format}")

        # Transcribe
        t_start = time.perf_counter()
        text, duration, detected_lang = _transcribe_audio(
            audio_bytes,
            language=language,
            task="transcribe",
            response_format=response_format,
            temperature=temperature
        )
        latency_s = time.perf_counter() - t_start

        if LOG_IO:
            logger.info(f"[TRANSCRIPTION OUTPUT] text={text[:100]}...")
            logger.info(f"[TRANSCRIPTION METRICS] latency={latency_s*1000:.1f}ms, duration={duration:.2f}s, rtf={latency_s/duration:.3f}")

        # Format response based on response_format
        if response_format == "text":
            return PlainTextResponse(content=text)

        elif response_format == "verbose_json":
            return JSONResponse(content={
                "task": "transcribe",
                "language": detected_lang,
                "duration": round(duration, 2),
                "text": text,
                "segments": []  # Could add segment support later
            })

        elif response_format == "srt":
            # Simple SRT format (single segment)
            srt_content = f"1\n00:00:00,000 --> {_format_timestamp(duration)}\n{text}\n"
            return PlainTextResponse(content=srt_content)

        elif response_format == "vtt":
            # WebVTT format
            vtt_content = f"WEBVTT\n\n1\n00:00:00.000 --> {_format_timestamp(duration, vtt=True)}\n{text}\n"
            return PlainTextResponse(content=vtt_content)

        else:  # json (default)
            return JSONResponse(content={"text": text})

    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/v1/audio/translations")
async def create_translation(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    prompt: Optional[str] = Form(default=None),
    response_format: str = Form(default="json"),
    temperature: float = Form(default=0.0)
):
    """
    OpenAI-compatible translation endpoint

    Translates audio into English.
    """
    if asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    try:
        # Read audio file
        audio_bytes = await file.read()

        if LOG_IO:
            logger.info(f"[TRANSLATION] file={file.filename}, size={len(audio_bytes)}, format={response_format}")

        # Translate (always to English)
        t_start = time.perf_counter()
        text, duration, _ = _transcribe_audio(
            audio_bytes,
            language=None,  # Auto-detect
            task="translate",
            response_format=response_format,
            temperature=temperature
        )
        latency_s = time.perf_counter() - t_start

        if LOG_IO:
            logger.info(f"[TRANSLATION OUTPUT] text={text[:100]}...")
            logger.info(f"[TRANSLATION METRICS] latency={latency_s*1000:.1f}ms, duration={duration:.2f}s, rtf={latency_s/duration:.3f}")

        # Format response
        if response_format == "text":
            return PlainTextResponse(content=text)
        else:  # json (default)
            return JSONResponse(content={"text": text})

    except Exception as e:
        logger.error(f"Translation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


# Legacy Endpoint (backward compatibility)

@app.post("/services/inference/pipeline", response_model=PipelineResponse)
def inference_pipeline(request: PipelineRequest):
    """Legacy pipeline endpoint for backward compatibility"""
    if not request.pipelineTasks:
        raise HTTPException(status_code=400, detail="pipelineTasks is empty")

    task = request.pipelineTasks[0]
    if task.taskType != "asr":
        raise HTTPException(status_code=400, detail=f"Unsupported taskType: '{task.taskType}'. Only 'asr' is supported.")

    if asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    if not request.inputData.audio:
        raise HTTPException(status_code=400, detail="inputData.audio is empty")

    lang_code = task.config.language.sourceLanguage
    sampling_rate = int(task.config.samplingRate or 16000)

    t_start = time.perf_counter()
    total_audio_duration_s = 0.0
    outputs: list[OutputItem] = []

    for audio_input in request.inputData.audio:
        if audio_input.audioContent:
            audio_bytes = base64.b64decode(audio_input.audioContent)
        elif audio_input.audioUri:
            with urllib.request.urlopen(audio_input.audioUri) as resp:
                audio_bytes = resp.read()
        else:
            raise HTTPException(status_code=400, detail="Each audio item must have audioContent or audioUri")

        if LOG_IO:
            logger.info(f"[ASR INPUT] lang={lang_code} audio_bytes={len(audio_bytes)}")

        text, audio_duration_s, _ = _transcribe_audio(audio_bytes, language=lang_code)
        total_audio_duration_s += audio_duration_s

        if LOG_IO:
            logger.info(f"[ASR OUTPUT] transcript={text!r}")

        outputs.append(OutputItem(source=text))

    latency_s = time.perf_counter() - t_start
    rtf = round(latency_s / total_audio_duration_s, 3) if total_audio_duration_s > 0 else 0.0

    if LOG_IO:
        logger.info(f"[ASR METRICS] latency={latency_s*1000:.1f}ms audio_dur={total_audio_duration_s:.2f}s rtf={rtf:.3f}")

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


# Utility Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OpenAI-Compatible Whisper ASR API Server",
        "endpoints": {
            "transcribe": "/v1/audio/transcriptions",
            "translate": "/v1/audio/translations",
            "health": "/health",
            "legacy_pipeline": "/services/inference/pipeline"
        }
    }


@app.get("/health")
def health():
    """Health check endpoint"""
    if asr_model is None:
        return {"status": "error", "detail": "Model not loaded"}
    return {
        "status": "ok",
        "model_loaded": True,
        "device": os.getenv("ASR_DEVICE", "GPU"),
        "model": os.getenv("ASR_MODEL_NAME", "openvino/whisper-base"),
    }


# Helper Functions

def _format_timestamp(seconds: float, vtt: bool = False) -> str:
    """Format timestamp for SRT/VTT"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)

    if vtt:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
    else:
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting server on {host}:{port}")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
