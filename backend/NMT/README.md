# IndicTrans2 NMT Service

## Setup

1. Create environment and install dependencies:
```bash
uv venv --python=3.12
.venv\Scripts\activate

uv pip install torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu
```

2. Install the indic tokenizer:
```bash
uv pip install -r requirements.txt
uv pip install indictranstoolkit
```

3. Convert the model to OpenVINO IR format:
```bash
python convert_indictrans2_ov.py   --model-name ai4bharat/indictrans2-indic-indic-1B --output-dir ./openvino_models/indictrans2-indic-indic-1B-fp16/ --device GPU
```

OR

```bash
python convert_indictrans2_ov.py   --model-name ai4bharat/indictrans2-indic-indic-1B --output-dir ./openvino_models/indictrans2-indic-indic-1B-fp16/ --device GPU --precision FP16
```


## Inference
```bash
python run_indictrans2_ov.py  --model-dir openvino_models\indictrans2-indic-indic-1B-fp16\optimum --device GPU --src-lang hin_Deva --tgt-lang tam_Taml --warmup 10
```


## Server

1. Run the script to start the server:
```bash
start_server_en_indic.bat
start_server_indic_indic.bat
```

## Testing
```bash
python test_nmt_en_indic.py
test_nmt_indic_indic.py
```

