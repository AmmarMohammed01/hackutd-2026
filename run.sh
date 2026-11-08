#!/bin/sh
set -eu
cd "$(dirname "$0")"

python3 -m venv .venv
. .venv/bin/activate
pip install -q -r server/requirements.txt

model="web/public/models/hand_landmarker.task"
if [ ! -f "$model" ]; then
  mkdir -p web/public/models
  curl -fsSL -o "$model" \
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
fi

if [ ! -d web/node_modules ]; then
  (cd web && npm install)
fi
(cd web && npm run build)

exec .venv/bin/uvicorn main:app --app-dir server --host 127.0.0.1 --port 8000
