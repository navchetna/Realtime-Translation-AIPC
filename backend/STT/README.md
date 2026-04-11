# IndicConformer Speech to Text Service


## Setup

1. Create environment and install dependencies:
    ```bash
    uv venv --python=3.10
    .venv\Scripts\activate
    uv pip install -r requirements.txt
    ```
2. Export the huggingface token to download the model:
    ```bash
    set HF_TOKEN=YOUR_TOKEN_HERE
    ```
3. Donwload the model
    ```bash
    hf download ai4bharat/indic-conformer-600m-multilingual --local-dir conformer_model
    ```
4. Convert the model to openvino format:
    ```bash
    python convert_to_openvino_fp16.py
    ```
5. Run the server:
    ```bash
    start_server.bat
    ```
    
## Inference

1. Run the scrpit to test the inference:
```python test_real_audio.py AUDIO_FILE_PATH hi CPU
```