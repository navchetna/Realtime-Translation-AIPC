#!/bin/bash
# Quick start script for vLLM OpenAI-compatible server

set -e

# Configuration
MODEL="${VLLM_MODEL:-meta-llama/Meta-Llama-3-8B-Instruct}"
HOST="${VLLM_HOST:-0.0.0.0}"
PORT="${VLLM_PORT:-8000}"
GPU_MEMORY="${GPU_MEMORY_UTIL:-0.95}"
TENSOR_PARALLEL="${TENSOR_PARALLEL_SIZE:-1}"

echo "========================================"
echo "Starting vLLM OpenAI-Compatible Server"
echo "========================================"
echo "Model: $MODEL"
echo "Host: $HOST"
echo "Port: $PORT"
echo "GPU Memory Utilization: $GPU_MEMORY"
echo "Tensor Parallel Size: $TENSOR_PARALLEL"
echo "========================================"
echo ""

# Check if vLLM is installed
if ! python -c "import vllm" 2>/dev/null; then
    echo "ERROR: vLLM is not installed"
    echo "Install with: pip install vllm"
    exit 1
fi

# Check CUDA availability
if ! python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
    echo "WARNING: CUDA is not available. Running on CPU (slow)"
fi

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL" \
    --host "$HOST" \
    --port "$PORT" \
    --gpu-memory-utilization "$GPU_MEMORY" \
    --tensor-parallel-size "$TENSOR_PARALLEL" \
    --dtype auto \
    --max-model-len 4096

echo ""
echo "Server stopped."
