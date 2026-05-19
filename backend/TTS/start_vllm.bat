@echo off
REM Quick start script for vLLM OpenAI-compatible server (Windows)

setlocal enabledelayedexpansion

REM Configuration
if not defined VLLM_MODEL set VLLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
if not defined VLLM_HOST set VLLM_HOST=0.0.0.0
if not defined VLLM_PORT set VLLM_PORT=8000
if not defined GPU_MEMORY_UTIL set GPU_MEMORY_UTIL=0.95
if not defined TENSOR_PARALLEL_SIZE set TENSOR_PARALLEL_SIZE=1

echo ========================================
echo Starting vLLM OpenAI-Compatible Server
echo ========================================
echo Model: %VLLM_MODEL%
echo Host: %VLLM_HOST%
echo Port: %VLLM_PORT%
echo GPU Memory Utilization: %GPU_MEMORY_UTIL%
echo Tensor Parallel Size: %TENSOR_PARALLEL_SIZE%
echo ========================================
echo.

REM Check if vLLM is installed
python -c "import vllm" 2>nul
if errorlevel 1 (
    echo ERROR: vLLM is not installed
    echo Install with: pip install vllm
    exit /b 1
)

REM Check CUDA availability
python -c "import torch; assert torch.cuda.is_available()" 2>nul
if errorlevel 1 (
    echo WARNING: CUDA is not available. Running on CPU ^(slow^)
)

echo Starting server...
echo.

REM Start vLLM server
python -m vllm.entrypoints.openai.api_server ^
    --model %VLLM_MODEL% ^
    --host %VLLM_HOST% ^
    --port %VLLM_PORT% ^
    --gpu-memory-utilization %GPU_MEMORY_UTIL% ^
    --tensor-parallel-size %TENSOR_PARALLEL_SIZE% ^
    --dtype auto ^
    --max-model-len 4096

echo.
echo Server stopped.
pause
