# Deploying the Realtime Translation AIPC App

## First-Time Setup

Run `setup.bat` once to download models, convert to OpenVINO, and install all dependencies. Requires `HF_TOKEN` set (see `.env`).

```bat
set HF_TOKEN=your_hf_token_here
.\setup.bat
```

> **Note:** You must accept the gated model terms on HuggingFace before running setup:
> - https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual
> - https://huggingface.co/ai4bharat/indictrans2-indic-indic-1B
> - https://huggingface.co/ai4bharat/indictrans2-en-indic-1B

## Running the App (after setup)

```bat
.\run.bat
```

This opens 3 terminal windows (STT, NMT, Frontend) and the app is available at **http://localhost:5173**.

## Stopping

Close the 3 terminal windows that `run.bat` opened, or press `Ctrl+C` in each.
