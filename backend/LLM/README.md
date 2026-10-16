# LLM — Translation via Ollama

Translation is handled by [Ollama](https://ollama.com), running a local LLM with an OpenAI-compatible API. There is no custom backend server in this folder.

## Setup

```cmd
setup.bat
```

This checks for Ollama, installs it via `winget` if missing, starts the Ollama service, and pulls the default translation model (`llama3.2`).

To use a different model:

```cmd
set OLLAMA_MODEL=mistral
setup.bat
```

Then update `VITE_OLLAMA_MODEL` in `frontend/.env.local` to match.

## Verifying Ollama

```cmd
curl http://localhost:11434/api/tags
ollama list
```

## API

The frontend calls Ollama's OpenAI-compatible endpoint directly:

```
POST http://localhost:11434/v1/chat/completions
```

`client.py` in this folder is a minimal test script for that endpoint:

```cmd
python client.py
```

## Model Options

| Model | Size | Notes |
|-------|------|-------|
| `llama3.2` | 2-3 GB | Default, balanced speed/quality |
| `mistral` | 4 GB | Higher quality |
| `gemma3:1b` | 1 GB | Fastest, lowest latency |
| `qwen2.5` | 3-7 GB | Strong multilingual support |

## Troubleshooting

- **Connection refused**: ensure Ollama is running (`ollama serve`) and port 11434 is free.
- **Model not found**: `ollama pull <model-name>`, then confirm the name matches `VITE_OLLAMA_MODEL` exactly.

