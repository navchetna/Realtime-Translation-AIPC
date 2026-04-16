import asyncio
import base64
import io
import logging
import os
import time
from uuid import uuid4

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.io.wavfile import write as wav_write

from main_ov import Text2SpeechApp
from utilities import SAMPLING_RATE, SUPPORTED_OUTPUT_LANGS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set LOG_IO=0 to suppress per-request TTS logging. Default: enabled.
LOG_IO = os.getenv("LOG_IO", "1").strip().lower() not in ("0", "false", "no", "off")

# --- Language code mapping (Bhashini 2-letter <-> full name) ---

LANG_CODE_TO_NAME = {
    "hi": "hindi",
    "ta": "tamil",
    "te": "telugu",
    "kn": "kannada",
    "ml": "malayalam",
    "pa": "punjabi",
    "bn": "bengali",
}
LANG_NAME_TO_CODE = {v: k for k, v in LANG_CODE_TO_NAME.items()}

# --- Pydantic models for Bhashini pipeline request/response ---


class LanguageConfig(BaseModel):
    sourceLanguage: str
    sourceScriptCode: str | None = None
    targetLanguage: str | None = None


class TaskConfig(BaseModel):
    language: LanguageConfig
    serviceId: str | None = None
    gender: str = "female"
    samplingRate: int = 48000


class PipelineTask(BaseModel):
    taskType: str
    config: TaskConfig


class InputItem(BaseModel):
    source: str


class InputData(BaseModel):
    input: list[InputItem] | None = None


class PipelineRequest(BaseModel):
    pipelineTasks: list[PipelineTask]
    inputData: InputData


class AudioItem(BaseModel):
    audioContent: str | None = None
    audioUri: str | None = None


class ResponseConfig(BaseModel):
    audioFormat: str = "wav"
    language: LanguageConfig
    encoding: str = "base64"
    samplingRate: int = 48000


class PipelineResponseItem(BaseModel):
    taskType: str
    config: ResponseConfig
    output: list | None = None
    audio: list[AudioItem] | None = None
    metrics: dict | None = None


class PipelineResponse(BaseModel):
    pipelineResponse: list[PipelineResponseItem]


class SimpleTtsRequest(BaseModel):
    text: str
    language: str = "hi"
    gender: str = "female"
    samplingRate: int = 48000


# --- App setup ---

app = FastAPI(title="FastSpeech2 TTS API (Bhashini-compatible)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dict of language_name -> Text2SpeechApp instance
tts_engines: dict[str, Text2SpeechApp] = {}


@app.on_event("startup")
def load_models():
    """Load TTS models for all configured languages at startup."""
    logger.info(f"SUPPORTED_OUTPUT_LANGS: {SUPPORTED_OUTPUT_LANGS}")
    logger.info(f"LANG_CODE_TO_NAME: {LANG_CODE_TO_NAME}")
    for lang_name in SUPPORTED_OUTPUT_LANGS:
        lang_name = lang_name.strip().lower()
        if lang_name not in LANG_NAME_TO_CODE:
            logger.warning(f"Unknown language '{lang_name}' in LANGUAGES env var, skipping.")
            continue
        logger.info(f"Loading TTS models for '{lang_name}'...")
        try:
            tts_engines[lang_name] = Text2SpeechApp(language=lang_name, dtype=os.getenv("TTS_DTYPE", "float32"))
            logger.info(f"✓ Successfully loaded '{lang_name}' with genders: {tts_engines[lang_name].supported_genders}")
        except Exception as e:
            logger.error(f"✗ Failed to load models for '{lang_name}': {str(e)}")
            logger.exception(f"Exception details for '{lang_name}':")
    logger.info(f"Final loaded languages: {list(tts_engines.keys())}")


def _synthesize(tts_app: Text2SpeechApp, text: str, gender: str, requested_sr: int) -> tuple[str, float]:
    """Run TTS inference and return base64-encoded WAV string and audio duration in seconds."""
    audio_tensor = tts_app.generate_audio_bytes(text=text, speaker_gender=gender)

    # Convert to int16 numpy
    if hasattr(audio_tensor, "numpy"):
        audio_np = audio_tensor.numpy().astype(np.int16)
    else:
        audio_np = np.array(audio_tensor, dtype=np.int16)

    # Resample if requested rate differs from native rate
    output_sr = SAMPLING_RATE
    if requested_sr != SAMPLING_RATE:
        import librosa
        audio_float = audio_np.astype(np.float32) / 32768.0
        audio_float = librosa.resample(audio_float, orig_sr=SAMPLING_RATE, target_sr=requested_sr)
        audio_np = (audio_float * 32768.0).astype(np.int16)
        output_sr = requested_sr

    # Write WAV to in-memory buffer
    buf = io.BytesIO()
    wav_write(buf, output_sr, audio_np)
    wav_bytes = buf.getvalue()
    audio_duration_s = float(len(audio_np) / output_sr) if output_sr > 0 else 0.0

    return base64.b64encode(wav_bytes).decode("ascii"), audio_duration_s


def _log_tts_input(req_id: str, endpoint: str, lang_code: str, gender: str, sampling_rate: int, text: str):
    if not LOG_IO:
        return

    logger.info(
        "[TTS  INPUT] req=%s endpoint=%s lang=%s gender=%s sr=%d chars=%d words=%d text=%r",
        req_id,
        endpoint,
        lang_code,
        gender,
        sampling_rate,
        len(text),
        len(text.split()),
        text,
    )


def _log_tts_metrics(
    req_id: str,
    endpoint: str,
    lang_code: str,
    gender: str,
    sampling_rate: int,
    item_count: int,
    latency_ms: float,
    audio_duration_s: float,
    rtf: float,
    total_base64_chars: int,
):
    if not LOG_IO:
        return

    logger.info(
        "[TTS METRICS] req=%s endpoint=%s lang=%s gender=%s sr=%d items=%d latency=%.2fms audio=%.3fs rtf=%.4f b64_chars=%d",
        req_id,
        endpoint,
        lang_code,
        gender,
        sampling_rate,
        item_count,
        latency_ms,
        audio_duration_s,
        rtf,
        total_base64_chars,
    )


def _resolve_tts_engine(lang_code: str, gender: str) -> tuple[str, Text2SpeechApp, str]:
    lang_code = lang_code.lower()
    lang_name = LANG_CODE_TO_NAME.get(lang_code)
    if not lang_name:
        raise HTTPException(status_code=400, detail=f"Unsupported language code: '{lang_code}'")

    if lang_name not in tts_engines:
        raise HTTPException(status_code=400, detail=f"Language '{lang_name}' not loaded. Available: {list(tts_engines.keys())}")

    tts_app = tts_engines[lang_name]

    resolved_gender = gender.lower()
    if resolved_gender not in tts_app.supported_genders:
        raise HTTPException(
            status_code=400,
            detail=f"Gender '{resolved_gender}' not available for '{lang_name}'. Available: {tts_app.supported_genders}"
        )

    return lang_name, tts_app, resolved_gender


@app.post("/services/inference/pipeline", response_model=PipelineResponse)
async def inference_pipeline(request: PipelineRequest):
    req_id = uuid4().hex[:8]
    t_start = time.perf_counter()
    if not request.pipelineTasks:
        raise HTTPException(status_code=400, detail="pipelineTasks is empty")

    task = request.pipelineTasks[0]

    if task.taskType != "tts":
        raise HTTPException(status_code=400, detail=f"Unsupported taskType: '{task.taskType}'. Only 'tts' is supported.")

    # Resolve language
    lang_code = task.config.language.sourceLanguage
    _, tts_app, gender = _resolve_tts_engine(lang_code, task.config.gender)

    requested_sr = task.config.samplingRate

    # Validate input
    if not request.inputData.input:
        raise HTTPException(status_code=400, detail="inputData.input is empty")

    # Process all input texts and collect audio
    audio_items = []
    total_audio_duration_s = 0.0
    total_base64_chars = 0
    total_characters = 0
    for item in request.inputData.input:
        _log_tts_input(req_id, "pipeline", lang_code, gender, requested_sr, item.source)
        b64_audio, audio_duration_s = await asyncio.to_thread(_synthesize, tts_app, item.source, gender, requested_sr)
        total_audio_duration_s += audio_duration_s
        total_base64_chars += len(b64_audio)
        total_characters += len(item.source)
        audio_items.append(AudioItem(audioContent=b64_audio, audioUri=None))

    latency_ms = round((time.perf_counter() - t_start) * 1000, 2)
    rtf = round((latency_ms / 1000) / total_audio_duration_s, 4) if total_audio_duration_s > 0 else 0.0
    synthesis_speed = round(total_characters / (latency_ms / 1000), 1) if latency_ms > 0 else 0.0
    _log_tts_metrics(
        req_id=req_id,
        endpoint="pipeline",
        lang_code=lang_code,
        gender=gender,
        sampling_rate=requested_sr,
        item_count=len(audio_items),
        latency_ms=latency_ms,
        audio_duration_s=round(total_audio_duration_s, 3),
        rtf=rtf,
        total_base64_chars=total_base64_chars,
    )

    response = PipelineResponse(
        pipelineResponse=[
            PipelineResponseItem(
                taskType="tts",
                config=ResponseConfig(
                    audioFormat="wav",
                    language=LanguageConfig(sourceLanguage=lang_code, sourceScriptCode=""),
                    encoding="base64",
                    samplingRate=requested_sr,
                ),
                output=None,
                audio=audio_items,
                metrics={
                    "latency_ms": latency_ms,
                    "audio_duration_s": round(total_audio_duration_s, 3),
                    "rtf": rtf,
                    "characters_processed": total_characters,
                    "synthesis_speed_chars_per_sec": synthesis_speed,
                },
            )
        ]
    )
    return response


@app.post("/tts")
async def tts_compat(request: SimpleTtsRequest):
    """Compatibility endpoint for clients calling /tts on port 5000."""
    req_id = uuid4().hex[:8]
    sentence = request.text.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="text is empty")

    lang_code = request.language
    _, tts_app, gender = _resolve_tts_engine(lang_code, request.gender)

    t_start = time.perf_counter()
    _log_tts_input(req_id, "tts", lang_code, gender, request.samplingRate, sentence)
    b64_audio, audio_duration_s = await asyncio.to_thread(_synthesize, tts_app, sentence, gender, request.samplingRate)
    latency_ms = round((time.perf_counter() - t_start) * 1000, 2)
    rtf = round((latency_ms / 1000) / audio_duration_s, 4) if audio_duration_s > 0 else 0.0
    synthesis_speed = round(len(sentence) / (latency_ms / 1000), 1) if latency_ms > 0 else 0.0
    _log_tts_metrics(
        req_id=req_id,
        endpoint="tts",
        lang_code=lang_code,
        gender=gender,
        sampling_rate=request.samplingRate,
        item_count=1,
        latency_ms=latency_ms,
        audio_duration_s=round(audio_duration_s, 3),
        rtf=rtf,
        total_base64_chars=len(b64_audio),
    )

    return {
        "audioContent": b64_audio,
        "audioFormat": "wav",
        "encoding": "base64",
        "samplingRate": request.samplingRate,
        "metrics": {
            "latency_ms": latency_ms,
            "audio_duration_s": round(audio_duration_s, 3),
            "rtf": rtf,
            "characters_processed": len(sentence),
            "synthesis_speed_chars_per_sec": synthesis_speed,
        },
    }


@app.get("/health")
def health():
    loaded_langs = {lang: engine.supported_genders for lang, engine in tts_engines.items()}
    return {
        "status": "ok",
        "loadedLanguages": loaded_langs,
        "availableLanguages": list(LANG_CODE_TO_NAME.values()),
    }
