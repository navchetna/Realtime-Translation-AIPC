#!/usr/bin/env python3
"""
FastAPI LLM Server with OpenAI-Compatible Endpoints
Simple server that wraps vLLM or other LLM backends
"""

import os
import time
import uuid
from typing import List, Optional, Union, Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Try to import vLLM
try:
    from vllm import LLM, SamplingParams
    from vllm.entrypoints.openai.protocol import (
        ChatCompletionRequest,
        ChatCompletionResponse,
        ChatCompletionResponseChoice,
        ChatCompletionResponseStreamChoice,
        ChatMessage,
        CompletionRequest,
        CompletionResponse,
        CompletionResponseChoice,
        DeltaMessage,
        ModelList,
        ModelCard,
        UsageInfo,
    )
    VLLM_AVAILABLE = True
except ImportError:
    VLLM_AVAILABLE = False
    print("WARNING: vLLM not installed. Install with: pip install vllm")

# Configuration
MODEL_NAME = os.getenv("MODEL_NAME", "meta-llama/Meta-Llama-3-8B-Instruct")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "4096"))

# Initialize FastAPI
app = FastAPI(
    title="LLM Server - OpenAI Compatible API",
    description="OpenAI-compatible endpoints for local LLM inference",
    version="1.0.0"
)

# Global LLM instance
llm_engine: Optional[LLM] = None


# Pydantic Models for OpenAI Compatibility
class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatCompletionRequestModel(BaseModel):
    model: str
    messages: List[Message]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    max_tokens: int = Field(default=512, ge=1)
    stream: bool = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)


class CompletionRequestModel(BaseModel):
    model: str
    prompt: Union[str, List[str]]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    max_tokens: int = Field(default=512, ge=1)
    stream: bool = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)


class ChatCompletionResponseModel(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[dict]
    usage: dict


class CompletionResponseModel(BaseModel):
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[dict]
    usage: dict


# Initialize LLM
def initialize_llm():
    """Initialize the LLM engine"""
    global llm_engine

    if not VLLM_AVAILABLE:
        print("ERROR: vLLM is not installed")
        return False

    try:
        print(f"Loading model: {MODEL_NAME}")
        llm_engine = LLM(
            model=MODEL_NAME,
            dtype="auto",
            max_model_len=MAX_TOKENS,
            gpu_memory_utilization=0.95,
        )
        print(f"Model loaded successfully: {MODEL_NAME}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to load model: {e}")
        return False


@app.on_event("startup")
async def startup_event():
    """Initialize LLM on startup"""
    print("=" * 70)
    print("Starting LLM Server with OpenAI-Compatible API")
    print("=" * 70)
    print(f"Model: {MODEL_NAME}")
    print(f"Host: {HOST}")
    print(f"Port: {PORT}")
    print(f"Max Tokens: {MAX_TOKENS}")
    print("=" * 70)

    if VLLM_AVAILABLE:
        success = initialize_llm()
        if not success:
            print("WARNING: LLM initialization failed. Server will return errors.")
    else:
        print("WARNING: vLLM not available. Server will return errors.")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "LLM Server - OpenAI Compatible API",
        "model": MODEL_NAME,
        "endpoints": {
            "chat": "/v1/chat/completions",
            "completions": "/v1/completions",
            "models": "/v1/models",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if llm_engine is not None else "unhealthy",
        "model_loaded": llm_engine is not None,
        "model": MODEL_NAME
    }


@app.get("/v1/models")
async def list_models():
    """List available models (OpenAI compatible)"""
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_NAME,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "local",
                "permission": [],
                "root": MODEL_NAME,
                "parent": None
            }
        ]
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequestModel):
    """OpenAI-compatible chat completions endpoint"""

    if llm_engine is None:
        raise HTTPException(status_code=503, detail="LLM engine not initialized")

    # Convert messages to prompt
    prompt = ""
    for message in request.messages:
        if message.role == "system":
            prompt += f"System: {message.content}\n"
        elif message.role == "user":
            prompt += f"User: {message.content}\n"
        elif message.role == "assistant":
            prompt += f"Assistant: {message.content}\n"
    prompt += "Assistant: "

    # Create sampling parameters
    sampling_params = SamplingParams(
        temperature=request.temperature,
        top_p=request.top_p,
        max_tokens=request.max_tokens,
        stop=request.stop if request.stop else None,
        presence_penalty=request.presence_penalty,
        frequency_penalty=request.frequency_penalty,
    )

    # Generate
    start_time = time.time()

    if request.stream:
        # Streaming response
        async def generate_stream():
            request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

            for output in llm_engine.generate([prompt], sampling_params, use_tqdm=False):
                if output.outputs:
                    delta_text = output.outputs[0].text

                    chunk = {
                        "id": request_id,
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": request.model,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": delta_text},
                            "finish_reason": None
                        }]
                    }
                    yield f"data: {chunk}\n\n"

            # Final chunk
            final_chunk = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {final_chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    else:
        # Non-streaming response
        outputs = llm_engine.generate([prompt], sampling_params, use_tqdm=False)
        output = outputs[0]

        completion_text = output.outputs[0].text
        prompt_tokens = len(output.prompt_token_ids)
        completion_tokens = len(output.outputs[0].token_ids)

        response = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": completion_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }
        }

        inference_time = time.time() - start_time
        print(f"[Chat] tokens={completion_tokens}, time={inference_time:.2f}s, "
              f"tokens/s={completion_tokens/inference_time:.1f}")

        return response


@app.post("/v1/completions")
async def completions(request: CompletionRequestModel):
    """OpenAI-compatible completions endpoint"""

    if llm_engine is None:
        raise HTTPException(status_code=503, detail="LLM engine not initialized")

    # Handle single or batch prompts
    prompts = request.prompt if isinstance(request.prompt, list) else [request.prompt]

    # Create sampling parameters
    sampling_params = SamplingParams(
        temperature=request.temperature,
        top_p=request.top_p,
        max_tokens=request.max_tokens,
        stop=request.stop if request.stop else None,
        presence_penalty=request.presence_penalty,
        frequency_penalty=request.frequency_penalty,
    )

    # Generate
    start_time = time.time()

    if request.stream:
        # Streaming response
        async def generate_stream():
            request_id = f"cmpl-{uuid.uuid4().hex[:12]}"

            for output in llm_engine.generate(prompts, sampling_params, use_tqdm=False):
                if output.outputs:
                    delta_text = output.outputs[0].text

                    chunk = {
                        "id": request_id,
                        "object": "text_completion",
                        "created": int(time.time()),
                        "model": request.model,
                        "choices": [{
                            "text": delta_text,
                            "index": 0,
                            "finish_reason": None
                        }]
                    }
                    yield f"data: {chunk}\n\n"

            # Final chunk
            final_chunk = {
                "id": request_id,
                "object": "text_completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "text": "",
                    "index": 0,
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {final_chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    else:
        # Non-streaming response
        outputs = llm_engine.generate(prompts, sampling_params, use_tqdm=False)

        choices = []
        total_prompt_tokens = 0
        total_completion_tokens = 0

        for idx, output in enumerate(outputs):
            completion_text = output.outputs[0].text
            prompt_tokens = len(output.prompt_token_ids)
            completion_tokens = len(output.outputs[0].token_ids)

            total_prompt_tokens += prompt_tokens
            total_completion_tokens += completion_tokens

            choices.append({
                "text": completion_text,
                "index": idx,
                "finish_reason": "stop"
            })

        response = {
            "id": f"cmpl-{uuid.uuid4().hex[:12]}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": choices,
            "usage": {
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "total_tokens": total_prompt_tokens + total_completion_tokens
            }
        }

        inference_time = time.time() - start_time
        print(f"[Completion] tokens={total_completion_tokens}, time={inference_time:.2f}s, "
              f"tokens/s={total_completion_tokens/inference_time:.1f}")

        return response


if __name__ == "__main__":
    import logging

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Start server
    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="info"
    )
