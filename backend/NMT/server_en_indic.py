"""
Bhashini-compatible NMT API server for EN -> Indic translation.
Uses IndicTrans2 OpenVINO inference engine.
Port: 8003
"""

import logging
import os
import signal
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set LOG_IO=0 to suppress per-request input/output logging. Default: enabled.
LOG_IO = os.getenv("LOG_IO", "1").strip() not in ("0", "false", "no", "off")

# Bhashini 2-letter code -> FLORES code mapping
LANG_CODE_TO_FLORES = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "bn": "ben_Beng",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "mr": "mar_Deva",
    "gu": "guj_Gujr",
    "pa": "pan_Guru",
    "or": "ory_Orya",
    "as": "asm_Beng",
    "ur": "urd_Arab",
    "ne": "npi_Deva",
    "si": "sin_Sinh",
    "sa": "san_Deva",
    "sd": "snd_Arab",
    "mai": "mai_Deva",
    "doi": "doi_Deva",
    "ks": "kas_Arab",
    "mni": "mni_Beng",
    "sat": "sat_Olck",
    "brx": "brx_Deva",
    "gom": "gom_Deva",
    "lus": "lus_Latn",
}
FLORES_TO_LANG_CODE = {v: k for k, v in LANG_CODE_TO_FLORES.items()}


# --- Pydantic models for Bhashini pipeline request/response ---

class LanguageConfig(BaseModel):
    sourceLanguage: str
    targetLanguage: str | None = None
    sourceScriptCode: str | None = None
    targetScriptCode: str | None = None


class TaskConfig(BaseModel):
    language: LanguageConfig
    serviceId: str | None = None


class PipelineTask(BaseModel):
    taskType: str
    config: TaskConfig


class InputItem(BaseModel):
    source: str


class BatchRequestItem(BaseModel):
    source: str
    targetLanguage: str


class InputData(BaseModel):
    input: list[InputItem] | None = None
    requests: list[BatchRequestItem] | None = None


class PipelineRequest(BaseModel):
    pipelineTasks: list[PipelineTask]
    inputData: InputData


class OutputItem(BaseModel):
    source: str
    target: str
    targetLanguage: str | None = None


class PipelineResponseItem(BaseModel):
    taskType: str
    config: dict | None = None
    output: list[OutputItem] | None = None
    metrics: dict | None = None


class PipelineResponse(BaseModel):
    pipelineResponse: list[PipelineResponseItem]


# --- App setup ---

app = FastAPI(title="IndicTrans2 EN->Indic NMT API (Bhashini-compatible)")

translator = None
_previous_sigint_handler = None
_previous_sigterm_handler = None


def _request_translator_stop(reason: str):
    if translator is not None and hasattr(translator, "request_stop"):
        logger.info("Shutdown signal received (%s). Requesting NMT generation stop...", reason)
        translator.request_stop()


def _install_signal_handlers():
    global _previous_sigint_handler, _previous_sigterm_handler

    _previous_sigint_handler = signal.getsignal(signal.SIGINT)
    _previous_sigterm_handler = signal.getsignal(signal.SIGTERM)

    def _handler(signum, frame):
        _request_translator_stop(f"signal={signum}")
        previous = _previous_sigint_handler if signum == signal.SIGINT else _previous_sigterm_handler
        if callable(previous):
            previous(signum, frame)

    signal.signal(signal.SIGINT, _handler)
    signal.signal(signal.SIGTERM, _handler)


@app.on_event("startup")
def load_model():
    global translator

    import importlib
    module = importlib.import_module("run_indictrans2-en-indic_ov")
    IndicTrans2OpenVINO = module.IndicTrans2OpenVINO

    device = os.getenv("NMT_DEVICE", "GPU")
    model_dir = os.getenv("NMT_MODEL_DIR", "./openvino_models/indictrans2-en-indic-1B-fp16/optimum")
    model_name = os.getenv("NMT_MODEL_NAME", "ai4bharat/indictrans2-en-indic-1B")
    warmup_iters = int(os.getenv("NMT_WARMUP", "3"))
    max_length = int(os.getenv("NMT_MAX_LENGTH", "128"))

    logger.info(f"Loading EN->Indic NMT model from '{model_dir}' on {device}...")
    translator = IndicTrans2OpenVINO(
        model_dir=model_dir,
        device=device,
        model_name=model_name,
        max_length=max_length,
    )

    if warmup_iters > 0:
        translator.warmup(warmup_iters)

    _install_signal_handlers()
    logger.info("EN->Indic NMT model ready")


@app.on_event("shutdown")
def shutdown_model():
    _request_translator_stop("lifespan-shutdown")


def _translate(sentences: list[str], src_lang: str, tgt_lang: str) -> list[str]:
    return translator.translate(sentences, src_lang=src_lang, tgt_lang=tgt_lang)


@app.post("/services/inference/pipeline", response_model=PipelineResponse)
def inference_pipeline(request: PipelineRequest):
    t_start = time.perf_counter()
    if not request.pipelineTasks:
        raise HTTPException(status_code=400, detail="pipelineTasks is empty")

    task = request.pipelineTasks[0]

    if task.taskType != "translation":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported taskType: '{task.taskType}'. Only 'translation' is supported.",
        )

    if translator is None:
        raise HTTPException(status_code=503, detail="NMT model not loaded")

    # Resolve source language once. Targets can be provided per item in batch mode.
    src_code = task.config.language.sourceLanguage.lower()

    if src_code != "en":
        raise HTTPException(
            status_code=400,
            detail=f"This server only supports English as source language. Got: '{src_code}'",
        )

    src_flores = LANG_CODE_TO_FLORES.get(src_code)
    if src_flores is None:
        raise HTTPException(status_code=400, detail=f"Unsupported source language: '{src_code}'")

    # Batch mode: one request can include many (text, targetLanguage) items.
    if request.inputData.requests:
        grouped: dict[str, list[tuple[int, str, str]]] = {}
        outputs: list[OutputItem | None] = [None] * len(request.inputData.requests)

        for i, item in enumerate(request.inputData.requests):
            tgt_code = item.targetLanguage.lower()
            if src_code == tgt_code:
                outputs[i] = OutputItem(source=item.source, target=item.source, targetLanguage=tgt_code)
                continue

            tgt_flores = LANG_CODE_TO_FLORES.get(tgt_code)
            if tgt_flores is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported target language: '{tgt_code}'. Supported: {list(LANG_CODE_TO_FLORES.keys())}",
                )

            grouped.setdefault(tgt_code, []).append((i, item.source, tgt_flores))

        for target_code, rows in grouped.items():
            texts = [row[1] for row in rows]
            tgt_flores = rows[0][2]
            if LOG_IO:
                for t in texts:
                    logger.info("[NMT  INPUT] %s->%s  source=%r", src_code, target_code, t)
            try:
                translated = _translate(texts, src_flores, tgt_flores)
            except RuntimeError as exc:
                if "Shutdown requested" in str(exc):
                    raise HTTPException(status_code=503, detail="Server is shutting down") from exc
                raise
            for row, tgt_text in zip(rows, translated):
                idx, src_text, _ = row
                if LOG_IO:
                    logger.info("[NMT OUTPUT] %s->%s  source=%r  target=%r", src_code, target_code, src_text, tgt_text)
                outputs[idx] = OutputItem(source=src_text, target=tgt_text, targetLanguage=target_code)

        final_outputs = [o for o in outputs if o is not None]
        latency_s = time.perf_counter() - t_start
        total_words = sum(len(o.target.split()) for o in final_outputs)
        tokens_per_sec = round(total_words / latency_s, 1) if latency_s > 0 else 0.0
        if LOG_IO:
            logger.info("[NMT METRICS] latency=%.1fms  approx_tokens=%d  tokens/s=%.1f",
                        latency_s * 1000, total_words, tokens_per_sec)
        return PipelineResponse(
            pipelineResponse=[
                PipelineResponseItem(
                    taskType="translation",
                    config={
                        "language": {
                            "sourceLanguage": src_code,
                        }
                    },
                    output=final_outputs,
                    metrics={
                        "latency_ms": round(latency_s * 1000, 1),
                        "approx_tokens": total_words,
                        "tokens_per_sec": tokens_per_sec,
                    },
                )
            ]
        )

    # Legacy mode: keep Bhashini single-target input format.
    tgt_code = (task.config.language.targetLanguage or "").lower()

    if not tgt_code:
        raise HTTPException(status_code=400, detail="targetLanguage is required")

    tgt_flores = LANG_CODE_TO_FLORES.get(tgt_code)

    if tgt_flores is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: '{tgt_code}'. Supported: {list(LANG_CODE_TO_FLORES.keys())}",
        )

    if not request.inputData.input:
        raise HTTPException(status_code=400, detail="inputData.input is empty")

    source_texts = [item.source for item in request.inputData.input]
    if LOG_IO:
        for t in source_texts:
            logger.info("[NMT  INPUT] %s->%s  source=%r", src_code, tgt_code, t)
    try:
        translations = _translate(source_texts, src_flores, tgt_flores)
    except RuntimeError as exc:
        if "Shutdown requested" in str(exc):
            raise HTTPException(status_code=503, detail="Server is shutting down") from exc
        raise
    if LOG_IO:
        for src, tgt in zip(source_texts, translations):
            logger.info("[NMT OUTPUT] %s->%s  source=%r  target=%r", src_code, tgt_code, src, tgt)

    outputs = [
        OutputItem(source=src, target=tgt, targetLanguage=tgt_code)
        for src, tgt in zip(source_texts, translations)
    ]

    latency_s = time.perf_counter() - t_start
    total_words = sum(len(t.split()) for t in translations)
    tokens_per_sec = round(total_words / latency_s, 1) if latency_s > 0 else 0.0
    if LOG_IO:
        logger.info("[NMT METRICS] latency=%.1fms  approx_tokens=%d  tokens/s=%.1f",
                    latency_s * 1000, total_words, tokens_per_sec)

    return PipelineResponse(
        pipelineResponse=[
            PipelineResponseItem(
                taskType="translation",
                config={
                    "language": {
                        "sourceLanguage": src_code,
                        "targetLanguage": tgt_code,
                    }
                },
                output=outputs,
                metrics={
                    "latency_ms": round(latency_s * 1000, 1),
                    "approx_tokens": total_words,
                    "tokens_per_sec": tokens_per_sec,
                },
            )
        ]
    )


@app.get("/health")
def health():
    if translator is None:
        return {"status": "error", "detail": "Model not loaded"}
    return {
        "status": "ok",
        "direction": "en-indic",
        "supported_targets": [k for k in LANG_CODE_TO_FLORES if k != "en"],
    }
