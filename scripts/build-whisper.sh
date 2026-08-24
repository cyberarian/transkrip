#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WHISPER_SRC="${WHISPER_CPP_DIR:-$PROJECT_DIR/vendor/whisper.cpp}"
BUILD_DIR="$WHISPER_SRC/build-em"

if ! command -v emcmake >/dev/null 2>&1; then
  echo "Emscripten is required. Activate emsdk so emcmake is on PATH." >&2
  exit 1
fi

if [ ! -f "$WHISPER_SRC/CMakeLists.txt" ]; then
  echo "whisper.cpp was not found at $WHISPER_SRC" >&2
  echo "Clone https://github.com/ggml-org/whisper.cpp there or set WHISPER_CPP_DIR." >&2
  exit 1
fi

emcmake cmake -S "$WHISPER_SRC" -B "$BUILD_DIR" -DWHISPER_WASM_SINGLE_FILE=ON
cmake --build "$BUILD_DIR" --target libmain -j
mkdir -p "$PROJECT_DIR/public/whisper"
cp "$BUILD_DIR/bin/whisper.wasm/main.js" "$PROJECT_DIR/public/whisper/main.js"
echo "Installed whisper.cpp browser runtime at public/whisper/main.js"
