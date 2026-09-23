#!/bin/bash
# transcribe.sh
# End-to-end transcription script for Video/Audio files with whisper.cpp & Zero-STT Hinglish

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$#" -lt 1 ]; then
    echo -e "${YELLOW}Usage: $0 <input_media_file> [output_dir]${NC}"
    echo "Example: $0 uploads/sample.mp4 uploads"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_DIR="${2:-.}"

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}Error: File '$INPUT_FILE' not found!${NC}"
    exit 1
fi

# 1. Determine Whisper CLI executable
if [ -z "$WHISPER_CLI" ]; then
    if [ -x "$SCRIPT_DIR/whisper.cpp/build/bin/whisper-cli" ]; then
        WHISPER_CLI="$SCRIPT_DIR/whisper.cpp/build/bin/whisper-cli"
    elif [ -x "$BACKEND_DIR/whisper.cpp/build/bin/whisper-cli" ]; then
        WHISPER_CLI="$BACKEND_DIR/whisper.cpp/build/bin/whisper-cli"
    elif [ -x "/home/amit/projects/speech2text/whisper.cpp/build/bin/whisper-cli" ]; then
        WHISPER_CLI="/home/amit/projects/speech2text/whisper.cpp/build/bin/whisper-cli"
    elif command -v whisper-cli >/dev/null 2>&1; then
        WHISPER_CLI="$(command -v whisper-cli)"
    else
        echo -e "${RED}Error: whisper-cli not found. Set WHISPER_CLI environment variable or build whisper.cpp.${NC}"
        exit 1
    fi
fi

# 2. Determine Model Path
if [ -z "$STT_MODEL_PATH" ]; then
    if [ -f "$BACKEND_DIR/models/zero-stt-hinglish/ggml-model.bin" ]; then
        STT_MODEL_PATH="$BACKEND_DIR/models/zero-stt-hinglish/ggml-model.bin"
    elif [ -f "$SCRIPT_DIR/models/zero-stt-hinglish/ggml-model.bin" ]; then
        STT_MODEL_PATH="$SCRIPT_DIR/models/zero-stt-hinglish/ggml-model.bin"
    elif [ -f "/home/amit/projects/speech2text/zero-stt-hinglish/ggml-model.bin" ]; then
        STT_MODEL_PATH="/home/amit/projects/speech2text/zero-stt-hinglish/ggml-model.bin"
    else
        echo -e "${RED}Error: STT Model not found. Set STT_MODEL_PATH environment variable.${NC}"
        exit 1
    fi
fi

BASENAME=$(basename "$INPUT_FILE" | sed 's/\.[^.]*$//')
TEMP_WAV="/tmp/${BASENAME}_16k_$$.wav"
OUTPUT_PREFIX="${OUTPUT_DIR}/${BASENAME}_transcript"

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}           Multimodal RAG - STT Transcription           ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo -e "Input File : ${YELLOW}$INPUT_FILE${NC}"
echo -e "Whisper CLI: ${YELLOW}$WHISPER_CLI${NC}"
echo -e "Model      : ${YELLOW}$STT_MODEL_PATH${NC}"
echo -e "Output     : ${YELLOW}${OUTPUT_PREFIX}.txt${NC}"

# Step 1: Extract 16kHz mono audio via ffmpeg
echo -e "\n${GREEN}[1/3] Extracting and converting media to 16kHz mono audio...${NC}"
ffmpeg -y -i "$INPUT_FILE" -vn -ac 1 -ar 16000 -loglevel error "$TEMP_WAV"

# Step 2: Run Whisper.cpp transcription
echo -e "\n${GREEN}[2/3] Transcribing with whisper.cpp...${NC}"
"$WHISPER_CLI" \
  -m "$STT_MODEL_PATH" \
  -f "$TEMP_WAV" \
  -l auto \
  -mc 0 \
  --entropy-thold 2.4 \
  --logprob-thold -1.0 \
  -np | tee "${OUTPUT_PREFIX}.txt"

# Step 3: Cleanup
echo -e "\n${GREEN}[3/3] Cleaning up temporary files...${NC}"
rm -f "$TEMP_WAV"

echo -e "\n${BLUE}========================================================${NC}"
echo -e "${GREEN}✅ Transcription Complete!${NC}"
echo -e "Saved to: ${YELLOW}${OUTPUT_PREFIX}.txt${NC}"
echo -e "${BLUE}========================================================${NC}"
