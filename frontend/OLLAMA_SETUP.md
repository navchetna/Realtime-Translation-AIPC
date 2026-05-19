# Ollama Setup for Voice-to-Voice Translation

This frontend uses **Ollama** for language translation. Ollama allows you to run large language models locally with an OpenAI-compatible API.

## Prerequisites

1. **Install Ollama**: Download and install from [ollama.ai](https://ollama.ai)

## Quick Start

### 1. Pull a Model

Choose and pull any Ollama model for translation. Popular options:

```bash
# Recommended: Fast and efficient
ollama pull llama3.2
ollama pull gemma3:1b

# Alternatives:
ollama pull mistral
ollama pull gemma2
ollama pull qwen2.5
ollama pull phi3
```

### 2. Start Ollama Server

Ollama runs automatically as a service after installation. Verify it's running:

```bash
# Test the server
curl http://localhost:11434/api/tags

# Or start manually if needed
ollama serve
```

### 3. Configure the Frontend

Copy the example environment file and update the model name:

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and set your chosen model:

```env
# Ollama Configuration
VITE_LLM_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma3:1b

# Update the display name too
VITE_LLM_MODEL_NAME=Ollama (gemma3:1b)
```

### 4. Start the Frontend

```bash
npm install
npm run dev
```

## Changing Models

To use a different model:

1. **Pull the new model:**
   ```bash
   ollama pull mistral
   ```

2. **Update `.env`:**
   ```env
   VITE_OLLAMA_MODEL=mistral
   VITE_LLM_MODEL_NAME=Ollama (mistral)
   ```

3. **Restart the frontend** (Ctrl+C and `npm run dev`)

## Supported Models

Any Ollama model will work. Popular choices:

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **gemma3:1b** | 1GB | Very Fast | Good | Real-time translation, low latency |
| **llama3.2** | 2-3GB | Fast | Good | General translation, balanced |
| **mistral** | 4GB | Fast | Excellent | High-quality translation |
| **gemma2** | 2-9GB | Medium | Excellent | Balanced performance |
| **qwen2.5** | 3-7GB | Fast | Excellent | Multilingual translation |
| **phi3** | 2GB | Very Fast | Good | Low-resource devices |

## Troubleshooting

### Connection Error
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check the URL in `.env` matches your Ollama server

### Model Not Found
- Pull the model: `ollama pull <model-name>`
- List available models: `ollama list`
- Check model name matches exactly (including `:1b` suffix if needed)

### Slow Translation
- Try a smaller model (gemma3:1b, phi3)
- Check system resources (RAM, CPU)
- Consider using GPU acceleration if available

### Empty Response
- Check console for errors
- Verify model name in `.env` matches installed model
- Test with curl: `curl http://localhost:11434/v1/chat/completions -d '{"model":"gemma3:1b","messages":[{"role":"user","content":"test"}]}'`

## API Details

The frontend uses Ollama's **OpenAI-compatible** `/v1/chat/completions` endpoint:

```javascript
POST http://localhost:11434/v1/chat/completions
{
  "model": "gemma3:1b",
  "messages": [
    {
      "role": "user",
      "content": "Translate from English to Japanese: Hello"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 256,
  "stream": false
}
```

**Important Notes:**
- Each translation is a **fresh request** with a single message
- No conversation history is maintained between translations
- The prompt includes source/target languages and text each time

## Performance Metrics

The frontend displays real-time metrics:
- **Tokens/sec**: Translation speed (from API's `usage.completion_tokens`)
- **Latency**: Total request time in milliseconds

## Testing Ollama

You can test Ollama directly with the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:11434/v1/',
    api_key='ollama',  # required but ignored
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            'role': 'user',
            'content': 'Translate to Japanese: Hello world',
        }
    ],
    model='gemma3:1b',
)
print(chat_completion.choices[0].message.content)
```

## Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Available Models](https://ollama.ai/library)
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [OpenAI Compatibility](https://github.com/ollama/ollama/blob/main/docs/openai.md)
