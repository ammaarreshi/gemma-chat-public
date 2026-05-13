#!/usr/bin/env python3
"""Download a model sequentially to avoid Python 3.13 ThreadPoolExecutor shutdown bug."""
import sys
import os
from pathlib import Path
from huggingface_hub import list_repo_files, hf_hub_download

def download_model(model_name: str, hf_home: str) -> None:
    os.environ['HF_HOME'] = hf_home
    os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

    Path(hf_home).mkdir(parents=True, exist_ok=True)

    print(f"Listing files for {model_name}...")
    files = list(list_repo_files(model_name))
    total = len(files)

    for i, filename in enumerate(files, 1):
        print(f"[{i}/{total}] {filename}")
        hf_hub_download(
            repo_id=model_name,
            filename=filename,
            cache_dir=os.path.join(hf_home, 'hub')
        )

    print(f"Done: {model_name}")
    sys.exit(0)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: download_model.py <model_name> <hf_home>")
        sys.exit(1)
    download_model(sys.argv[1], sys.argv[2])
