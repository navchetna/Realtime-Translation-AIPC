import base64
import io
import logging
import os
import time
import urllib.request

import numpy as np
import openvino_genai as ov_genai
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOG_IO = os.getenv("LOG_IO", "1").strip().lower() not in ("0", "false", "no", "off")


class Whisper:
    def __init__(self, model_name: str, device: str = "GPU"):
        self.pipeline = ov_genai.WhisperPipeline(model_name, device=device)
        self.tokenizer = self.pipeline.get_tokenizer()

    @staticmethod
    def convert_bytes_to_array(audio_bytes: bytes, fallback_sr: int = 16000):
        # Try standard container decoding first (wav/flac/ogg/etc.).
        try:
            audio_stream = io.BytesIO(audio_bytes)
            audio_array, sr = sf.read(file=audio_stream, dtype="float32")
            return audio_array, sr
        except sf.LibsndfileError:
            # Frontend streams raw Float32 PCM bytes from VAD; decode directly.
            if len(audio_bytes) % 4 != 0:
                raise ValueError("Raw Float32 audio payload size must be divisible by 4 bytes")
            audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
            return audio_array, int(fallback_sr)

    def generate(self, audio_array, language: str = "<|en|>"):
        transcription = self.pipeline.generate(
            audio_array,
            task="transcribe",
            return_timestamps=False,
            language=language,
        )
        return transcription


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


app = FastAPI(title="Whisper OpenVINO ASR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

asr_model: Whisper | None = None


@app.on_event("startup")
def load_model():
    global asr_model

    device = os.getenv("ASR_DEVICE", "GPU")
    model_name = os.getenv("ASR_MODEL_NAME", "openvino/whisper-base")

    logger.info("Loading Whisper model '%s' on %s", model_name, device)
    try:
        asr_model = Whisper(model_name=model_name, device=device)
        logger.info("Whisper model loaded successfully")
    except Exception:
        logger.exception("Failed to load Whisper model")


def _language_to_whisper_token(lang_code: str) -> str:
    lang = (lang_code or "en").strip().lower()
    mapping = {
        "en": "<|en|>",
        "english": "<|en|>",
    }
    return mapping.get(lang, "<|en|>")


def _transcribe(audio_bytes: bytes, lang_code: str, sampling_rate: int = 16000) -> tuple[str, float]:
    if asr_model is None:
        raise RuntimeError("ASR model not loaded")

    audio_array, sr = asr_model.convert_bytes_to_array(audio_bytes, fallback_sr=sampling_rate)
    if getattr(audio_array, "ndim", 1) > 1:
        audio_array = audio_array.mean(axis=1)

    if len(audio_array) == 0:
        raise ValueError("Received empty audio payload")

    audio_duration_s = float(len(audio_array)) / float(sr) if sr else 0.0
    transcription = asr_model.generate(audio_array, language=_language_to_whisper_token(lang_code))
    text = str(transcription)
    return text, audio_duration_s


@app.post("/services/inference/pipeline", response_model=PipelineResponse)
def inference_pipeline(request: PipelineRequest):
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
            logger.info("[ASR INPUT] lang=%s audio_bytes=%d", lang_code, len(audio_bytes))

        text, audio_duration_s = _transcribe(audio_bytes, lang_code, sampling_rate=sampling_rate)
        total_audio_duration_s += audio_duration_s

        if LOG_IO:
            logger.info("[ASR OUTPUT] transcript=%r", text)

        outputs.append(OutputItem(source=text))

    latency_s = time.perf_counter() - t_start
    rtf = round(latency_s / total_audio_duration_s, 3) if total_audio_duration_s > 0 else 0.0

    if LOG_IO:
        logger.info("[ASR METRICS] latency=%.1fms audio_dur=%.2fs rtf=%.3f", latency_s * 1000, total_audio_duration_s, rtf)

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
    return {
        "status": "ok",
        "device": os.getenv("ASR_DEVICE", "GPU"),
        "model": os.getenv("ASR_MODEL_NAME", "openvino/whisper-base"),
    }
