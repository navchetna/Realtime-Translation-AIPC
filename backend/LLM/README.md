# Translation Service - Use Ollama

This project uses **Ollama** for local LLM-based translation instead of a separate backend service.

## Why Ollama?

Ollama provides:
- **Easy Setup** - Single command installation
- **Model Flexibility** - Switch models instantly
- **Better Performance** - Optimized local inference
- **Active Development** - Regular updates and improvements
- **Wide Model Support** - Access to hundreds of models

## Quick Setup

### 1. Install Ollama

Download and install from: **https://ollama.ai**

**Windows:**
- Download the installer
- Run and install
- Ollama runs automatically as a service

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

### 2. Pull a Translation Model

Choose any model that fits your needs:

```bash
# Recommended: Fast and efficient
ollama pull llama3.2

# Alternatives:
ollama pull mistral      # High quality
ollama pull gemma2       # Balanced
ollama pull qwen2.5      # Multilingual expert
ollama pull phi3         # Lightweight
```

### 3. Verify Ollama is Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# List installed models
ollama list

# Test a model
ollama run llama3.2 "Translate to Japanese: Hello world"
```

### 4. Configure the Frontend

The frontend is already configured to use Ollama. Just update your model preference:

**Edit `frontend/.env` or `frontend/.env.local`:**

```env
# Ollama Configuration
VITE_LLM_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.2

# Update display name
VITE_LLM_MODEL_NAME=Ollama (llama3.2)
```

## Changing Models

To switch translation models:

1. **Pull the new model:**
   ```bash
   ollama pull mistral
   ```

2. **Update frontend config:**
   ```env
   VITE_OLLAMA_MODEL=mistral
   VITE_LLM_MODEL_NAME=Ollama (mistral)
   ```

3. **Restart the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

That's it! No backend service needed.

## Model Recommendations

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **llama3.2** | 2-3GB | ⚡⚡⚡ | ⭐⭐⭐ | General translation (recommended) |
| **mistral** | 4GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | High-quality translation |
| **gemma2** | 2-9GB | ⚡⚡ | ⭐⭐⭐⭐ | Balanced performance |
| **qwen2.5** | 3-7GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | Multilingual translation |
| **phi3** | 2GB | ⚡⚡⚡⚡ | ⭐⭐ | Low-resource devices |

## API Endpoint

Ollama runs on: **http://localhost:11434**

The frontend uses: **OpenAI-compatible `/v1/chat/completions`** endpoint

Example request:
```json
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

**Test with Python:**
```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:11434/v1/',
    api_key='ollama',  # required but ignored
)

response = client.chat.completions.create(
    model='gemma3:1b',
    messages=[{'role': 'user', 'content': 'Translate to Japanese: Hello'}]
)
print(response.choices[0].message.content)
```

## Troubleshooting

### Ollama Not Running

```bash
# Check if Ollama is installed
ollama --version

# Start Ollama manually (if needed)
ollama serve
```

### Model Not Found

```bash
# List installed models
ollama list

# Pull missing model
ollama pull llama3.2
```

### Connection Refused

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check firewall settings
- Ensure port 11434 is not blocked

### Slow Translation

- Try a smaller model: `ollama pull phi3`
- Check system resources (RAM, CPU)
- Close other applications

## Additional Resources

- 📚 **Ollama Setup Guide**: See `frontend/OLLAMA_SETUP.md` for detailed instructions
- 🌐 **Ollama Website**: https://ollama.ai
- 📖 **Ollama Docs**: https://github.com/ollama/ollama
- 🤖 **Model Library**: https://ollama.ai/library
- 💬 **API Reference**: https://github.com/ollama/ollama/blob/main/docs/api.md

## Why No Backend Service Here?

Previously, this folder contained a custom LLM backend service. We switched to Ollama because:

1. **Simpler Setup** - One command vs. virtual environment + dependencies
2. **Better Models** - Access to state-of-the-art models
3. **Easy Updates** - `ollama pull` to get new models
4. **Lower Maintenance** - No backend code to maintain
5. **Better Performance** - Optimized inference engine
6. **Flexibility** - Change models without code changes

## Migration Notes

If you were using the old backend:

**Old way:**
```bash
cd backend/LLM
setup.bat
start_server.bat
```

**New way:**
```bash
ollama pull llama3.2
# That's it! Frontend connects directly to Ollama
```

---

**Need help?** See the [Ollama Setup Guide](../../frontend/OLLAMA_SETUP.md) for comprehensive instructions.
