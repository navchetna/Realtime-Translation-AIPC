#!/usr/bin/env python3
"""
OpenAI-compatible TTS API Server
OpenVINO-based inference for Supertonic TTS
"""

import io
import json
import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
import openvino as ov
from openvino import Core
import soundfile as sf
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import helper functions
from helper import (
    AVAILABLE_LANGS,
    Style,
    UnicodeProcessor,
    chunk_text,
    get_latent_mask,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent

# Default paths
DEFAULT_MODEL_DIR = SCRIPT_DIR / "supertonic_v3_ov"
DEFAULT_CONFIG_DIR = SCRIPT_DIR / "supertonic" / "onnx"
DEFAULT_VOICE_STYLES_DIR = SCRIPT_DIR / "supertonic-3" / "voice_styles"


class TextToSpeechOpenVINO:
    """OpenVINO-based Text-to-Speech inference engine"""

    def __init__(
        self,
        cfgs: dict,
        text_processor: UnicodeProcessor,
        core: Core,
        dp_model,
        text_enc_model,
        vector_est_model,
        vocoder_model,
    ):
        self.cfgs = cfgs
        self.text_processor = text_processor
        self.core = core
        self.dp_model = dp_model
        self.text_enc_model = text_enc_model
        self.vector_est_model = vector_est_model
        self.vocoder_model = vocoder_model

        self.sample_rate = cfgs["ae"]["sample_rate"]
        self.base_chunk_size = cfgs["ae"]["base_chunk_size"]
        self.chunk_compress_factor = cfgs["ttl"]["chunk_compress_factor"]
        self.ldim = cfgs["ttl"]["latent_dim"]

    def sample_noisy_latent(self, duration: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Generate noisy latent representation based on duration."""
        bsz = len(duration)
        wav_len_max = duration.max() * self.sample_rate
        wav_lengths = (duration * self.sample_rate).astype(np.int64)
        chunk_size = self.base_chunk_size * self.chunk_compress_factor
        latent_len = ((wav_len_max + chunk_size - 1) / chunk_size).astype(np.int32)
        latent_dim = self.ldim * self.chunk_compress_factor
        noisy_latent = np.random.randn(bsz, latent_dim, latent_len).astype(np.float32)
        latent_mask = get_latent_mask(
            wav_lengths, self.base_chunk_size, self.chunk_compress_factor
        )
        noisy_latent = noisy_latent * latent_mask
        return noisy_latent, latent_mask

    def _infer(
        self,
        text_list: list[str],
        lang_list: list[str],
        style: Style,
        total_step: int,
        speed: float = 1.05,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Internal inference method."""
        assert len(text_list) == style.ttl.shape[0], "Text count must match style vectors"
        bsz = len(text_list)
        text_ids, text_mask = self.text_processor(text_list, lang_list)

        # Duration prediction
        dp_result = self.dp_model.infer_new_request({
            "text_ids": text_ids,
            "style_dp": style.dp,
            "text_mask": text_mask,
        })
        dur_onnx = list(dp_result.values())[0] / speed

        # Text encoding
        text_enc_result = self.text_enc_model.infer_new_request({
            "text_ids": text_ids,
            "style_ttl": style.ttl,
            "text_mask": text_mask,
        })
        text_emb_onnx = list(text_enc_result.values())[0]

        xt, latent_mask = self.sample_noisy_latent(dur_onnx)
        total_step_np = np.array([total_step] * bsz, dtype=np.float32)

        # Vector estimation loop
        for step in range(total_step):
            current_step = np.array([step] * bsz, dtype=np.float32)
            vector_est_result = self.vector_est_model.infer_new_request({
                "noisy_latent": xt,
                "text_emb": text_emb_onnx,
                "style_ttl": style.ttl,
                "text_mask": text_mask,
                "latent_mask": latent_mask,
                "current_step": current_step,
                "total_step": total_step_np,
            })
            xt = list(vector_est_result.values())[0]

        # Vocoder
        vocoder_result = self.vocoder_model.infer_new_request({"latent": xt})
        wav = list(vocoder_result.values())[0]

        return wav, dur_onnx

    def __call__(
        self,
        text: str,
        lang: str,
        style: Style,
        total_step: int,
        speed: float = 1.05,
        silence_duration: float = 0.3,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Generate speech from text."""
        assert style.ttl.shape[0] == 1, "Single speaker TTS only"
        max_len = 120 if lang in ("ko", "ja") else 300
        text_list = chunk_text(text, max_len=max_len)
        wav_cat = None
        dur_cat = None

        for text_chunk in text_list:
            wav, dur_onnx = self._infer([text_chunk], [lang], style, total_step, speed)
            if wav_cat is None:
                wav_cat = wav
                dur_cat = dur_onnx
            else:
                silence = np.zeros((1, int(silence_duration * self.sample_rate)), dtype=np.float32)
                wav_cat = np.concatenate([wav_cat, silence, wav], axis=1)
                dur_cat += dur_onnx + silence_duration

        return wav_cat, dur_cat


def load_openvino_model(core: Core, model_path: Path, device: str, force_fp32: bool = False):
    """Load and compile an OpenVINO model."""
    model = core.read_model(model_path)
    config = {}
    if "GPU" in device and force_fp32:
        config["INFERENCE_PRECISION_HINT"] = "f32"
    return core.compile_model(model, device, config)


def load_tts_engine(
    model_dir: str,
    config_dir: str,
    device: str = "CPU",
    force_fp32: bool = True,
) -> TextToSpeechOpenVINO:
    """Load TTS engine with OpenVINO backend."""
    model_dir = Path(model_dir)
    config_dir = Path(config_dir)

    logger.info(f"Loading TTS engine with OpenVINO on {device}")
    logger.info(f"  Model directory: {model_dir}")
    logger.info(f"  Config directory: {config_dir}")

    # Initialize OpenVINO
    core = Core()
    logger.info(f"  Available devices: {core.available_devices}")

    # Load config
    cfg_path = config_dir / "tts.json"
    with open(cfg_path, "r") as f:
        cfgs = json.load(f)

    # Load text processor
    unicode_indexer_path = config_dir / "unicode_indexer.json"
    text_processor = UnicodeProcessor(str(unicode_indexer_path))

    # Load OpenVINO models
    logger.info("  Loading models...")
    dp_model = load_openvino_model(core, model_dir / "duration_predictor.xml", device, force_fp32)
    logger.info("    - Duration predictor loaded")

    text_enc_model = load_openvino_model(core, model_dir / "text_encoder.xml", device, force_fp32)
    logger.info("    - Text encoder loaded")

    vector_est_model = load_openvino_model(core, model_dir / "vector_estimator.xml", device, force_fp32)
    logger.info("    - Vector estimator loaded")

    vocoder_model = load_openvino_model(core, model_dir / "vocoder.xml", device, force_fp32)
    logger.info("    - Vocoder loaded")

    logger.info(f"TTS engine initialized on {device}")

    return TextToSpeechOpenVINO(
        cfgs=cfgs,
        text_processor=text_processor,
        core=core,
        dp_model=dp_model,
        text_enc_model=text_enc_model,
        vector_est_model=vector_est_model,
        vocoder_model=vocoder_model,
    )


def load_voice_style(voice_style_path: str) -> Style:
    """Load voice style from JSON file."""
    with open(voice_style_path, "r") as f:
        voice_style = json.load(f)

    ttl_dims = voice_style["style_ttl"]["dims"]
    dp_dims = voice_style["style_dp"]["dims"]

    ttl_data = np.array(voice_style["style_ttl"]["data"], dtype=np.float32).flatten()
    ttl_style = ttl_data.reshape(1, ttl_dims[1], ttl_dims[2])

    dp_data = np.array(voice_style["style_dp"]["data"], dtype=np.float32).flatten()
    dp_style = dp_data.reshape(1, dp_dims[1], dp_dims[2])

    return Style(ttl_style, dp_style)


# FastAPI App
app = FastAPI(
    title="OpenAI-Compatible TTS API",
    description="Text-to-Speech API compatible with OpenAI's TTS endpoint",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Global TTS engine and voice styles
tts_engine: Optional[TextToSpeechOpenVINO] = None
voice_styles = {}


class TTSRequest(BaseModel):
    """OpenAI-compatible TTS request"""
    model: str = Field(default="tts-1", description="TTS model to use")
    input: str = Field(..., description="Text to synthesize", max_length=4096)
    voice: str = Field(default="alloy", description="Voice to use")
    response_format: str = Field(default="mp3", description="Audio format")
    speed: float = Field(default=1.0, description="Speech speed", ge=0.25, le=4.0)
    language: Optional[str] = Field(default="en", description="Language code")


class TTSConfig:
    """TTS configuration"""
    def __init__(self):
        self.model_dir = os.getenv("MODEL_DIR", str(DEFAULT_MODEL_DIR))
        self.config_dir = os.getenv("CONFIG_DIR", str(DEFAULT_CONFIG_DIR))
        self.voice_styles_dir = os.getenv("VOICE_STYLES_DIR", str(DEFAULT_VOICE_STYLES_DIR))
        self.device = os.getenv("DEVICE", "CPU")
        self.precision = os.getenv("PRECISION", "fp32")
        self.diffusion_steps = int(os.getenv("DIFFUSION_STEPS", "8"))
        self.default_voice = os.getenv("DEFAULT_VOICE", "alloy")
        self.default_language = os.getenv("DEFAULT_LANGUAGE", "en")


config = TTSConfig()


def load_available_voice_styles(voice_styles_dir: Path) -> dict:
    """Load all available voice styles"""
    logger.info(f"Loading voice styles from {voice_styles_dir}")
    styles = {}

    if not voice_styles_dir.exists():
        logger.warning(f"Voice styles directory not found: {voice_styles_dir}")
        return styles

    openai_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    voice_files = sorted(voice_styles_dir.glob("*.json"))

    for i, voice_file in enumerate(voice_files):
        voice_name = openai_voices[i] if i < len(openai_voices) else voice_file.stem
        try:
            style = load_voice_style(str(voice_file))
            styles[voice_name] = style
            logger.info(f"  Loaded voice '{voice_name}' from {voice_file.name}")
        except Exception as e:
            logger.error(f"  Failed to load voice from {voice_file}: {e}")

    logger.info(f"Loaded {len(styles)} voice styles")
    return styles


def convert_audio_format(audio_data: np.ndarray, sample_rate: int, target_format: str) -> bytes:
    """Convert audio to target format"""
    audio_bytes = io.BytesIO()

    if target_format == "pcm":
        audio_int16 = (audio_data.squeeze() * 32767).astype(np.int16)
        return audio_int16.tobytes()

    elif target_format == "wav":
        sf.write(audio_bytes, audio_data.squeeze(), sample_rate, format="WAV")

    elif target_format == "mp3":
        try:
            from pydub import AudioSegment
            wav_bytes = io.BytesIO()
            sf.write(wav_bytes, audio_data.squeeze(), sample_rate, format="WAV")
            wav_bytes.seek(0)
            audio_segment = AudioSegment.from_wav(wav_bytes)
            audio_segment.export(audio_bytes, format="mp3", bitrate="128k")
        except ImportError:
            logger.warning("pydub not available, falling back to WAV")
            sf.write(audio_bytes, audio_data.squeeze(), sample_rate, format="WAV")

    elif target_format == "flac":
        sf.write(audio_bytes, audio_data.squeeze(), sample_rate, format="FLAC")

    else:
        sf.write(audio_bytes, audio_data.squeeze(), sample_rate, format="WAV")

    audio_bytes.seek(0)
    return audio_bytes.read()


def get_content_type(format: str) -> str:
    """Get MIME type for audio format"""
    format_map = {
        "mp3": "audio/mpeg",
        "opus": "audio/opus",
        "aac": "audio/aac",
        "flac": "audio/flac",
        "wav": "audio/wav",
        "pcm": "audio/pcm"
    }
    return format_map.get(format, "audio/wav")


@app.on_event("startup")
async def startup_event():
    """Initialize TTS engine on startup"""
    global tts_engine, voice_styles

    logger.info("=" * 70)
    logger.info("Initializing TTS API Server")
    logger.info("=" * 70)
    logger.info(f"Model directory: {config.model_dir}")
    logger.info(f"Config directory: {config.config_dir}")
    logger.info(f"Voice styles directory: {config.voice_styles_dir}")
    logger.info(f"Device: {config.device}")
    logger.info(f"Precision: {config.precision}")
    logger.info(f"Diffusion steps: {config.diffusion_steps}")
    logger.info("=" * 70)

    try:
        # Load TTS engine
        force_fp32 = config.precision == "fp32"
        tts_engine = load_tts_engine(
            model_dir=config.model_dir,
            config_dir=config.config_dir,
            device=config.device,
            force_fp32=force_fp32
        )
        logger.info("TTS engine loaded successfully")

        # Load voice styles
        voice_styles = load_available_voice_styles(Path(config.voice_styles_dir))

        if not voice_styles:
            logger.warning("No voice styles loaded!")

        logger.info("=" * 70)
        logger.info("TTS API Server ready")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"Failed to initialize TTS engine: {e}", exc_info=True)
        raise


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OpenAI-Compatible TTS API Server",
        "endpoints": {
            "tts": "/v1/audio/speech",
            "health": "/health",
            "voices": "/v1/voices"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if tts_engine is not None else "unhealthy",
        "model_loaded": tts_engine is not None,
        "voices_loaded": len(voice_styles),
        "device": config.device
    }


@app.get("/v1/voices")
async def list_voices():
    """List available voices"""
    return {
        "voices": list(voice_styles.keys()),
        "default_voice": config.default_voice,
        "supported_languages": AVAILABLE_LANGS
    }


@app.post("/v1/audio/speech")
async def create_speech(request: TTSRequest):
    """OpenAI-compatible TTS endpoint"""
    import time

    if tts_engine is None:
        raise HTTPException(status_code=503, detail="TTS engine not initialized")

    # Validate voice
    voice = request.voice
    if voice not in voice_styles:
        logger.warning(f"Voice '{voice}' not found, using default '{config.default_voice}'")
        voice = config.default_voice
        if voice not in voice_styles:
            if voice_styles:
                voice = list(voice_styles.keys())[0]
            else:
                raise HTTPException(status_code=500, detail="No voices available")

    # Validate language
    language = request.language if request.language else config.default_language
    if language not in AVAILABLE_LANGS:
        logger.warning(f"Language '{language}' not supported, using '{config.default_language}'")
        language = config.default_language

    style = voice_styles[voice]

    try:
        text_preview = request.input[:100] + "..." if len(request.input) > 100 else request.input
        logger.info(f"[TTS] text_len={len(request.input)}, preview=\"{text_preview}\", voice={voice}, lang={language}, speed={request.speed}")

        # Adjust speed (invert for Supertonic)
        speed_multiplier = 1.05 / request.speed

        # Generate speech
        t_start = time.perf_counter()
        audio_data, duration = tts_engine(
            text=request.input,
            lang=language,
            style=style,
            total_step=config.diffusion_steps,
            speed=speed_multiplier
        )
        inference_time = time.perf_counter() - t_start

        audio_duration_s = duration[0]
        rtf = inference_time / audio_duration_s if audio_duration_s > 0 else 0.0

        logger.info(f"[TTS] duration={audio_duration_s:.2f}s, inference={inference_time*1000:.1f}ms, rtf={rtf:.3f}")

        # Convert format
        audio_bytes = convert_audio_format(audio_data, tts_engine.sample_rate, request.response_format)
        logger.info(f"[TTS] format={request.response_format}, size={len(audio_bytes)/1024:.1f}KB")

        return Response(
            content=audio_bytes,
            media_type=get_content_type(request.response_format),
            headers={"Content-Disposition": f'attachment; filename="speech.{request.response_format}"'}
        )

    except Exception as e:
        logger.error(f"TTS generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
