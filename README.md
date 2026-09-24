# Multimodal RAG: Video & Document Intelligence with Deep Temporal Citations

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-orange.svg)](https://www.trychroma.com/)
[![Whisper.cpp](https://img.shields.io/badge/Whisper.cpp-CUDA_Accelerated-blue.svg)](https://github.com/ggerganov/whisper.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An end-to-end, production-ready **Multimodal Retrieval-Augmented Generation (RAG)** platform capable of ingesting both **PDF documents** and **long-form video/audio files**. 

The system provides precise, interactive citations: clicking a citation badge in an answer jumps the synchronized media player to the exact video timestamp or navigates the PDF viewer to the exact cited page.

---

## 🎥 Live Demo

Watch the complete multimodal pipeline in action: uploading a document, ingesting video, transcribing speech with millisecond timestamps, balanced ChromaDB retrieval, and interactive citations that seek the video player to the exact second:

https://github.com/user-attachments/assets/53b286a9-31b3-4b03-af22-88797c155bd5

> 💡 *Tip: If the embedded player above is not loading in your browser, you can also view or download [`Multimodal_demo.mp4`](Multimodal_demo.mp4) directly.*

---

## 🚀 Key Highlights & Capabilities

- 🎬 **Video Understanding with Timestamp Citations**:
  - Automatically extracts 16kHz mono audio from uploaded media via `ffmpeg`.
  - Transcribes audio using `whisper.cpp` (with anti-hallucination heuristics `-mc 0`, `--entropy-thold 2.4`, `--logprob-thold -1.0`).
  - Segments transcripts with millisecond-accurate timestamps and stores chunk embeddings into **ChromaDB**.
  - Clicking a video citation (`[1]`, `[2]`) in the assistant's answer instantly seeks the integrated video player to the exact second.

- 📄 **Interactive PDF Document RAG**:
  - Extracts text per page using `pypdf` with `RecursiveCharacterTextSplitter`.
  - Preserves exact page-number metadata for every indexed chunk.
  - Clicking a PDF citation badge automatically flips the client-side canvas PDF viewer to the cited page with a highlighted visual flash indicator.

- 🧠 **Source-Balanced Multi-Document Retrieval**:
  - Employs a custom balanced retrieval algorithm (`MIN_PER_SOURCE = 4`, `TOTAL_CONTEXT = 15`) to ensure equal evidence representation across all files uploaded in a session, preventing high-density documents from starving others.

- ⚡ **Dual LLM Architecture (Local & Cloud)**:
  - **Local Model**: Connects to OpenAI-compatible local inference engines (`llama.cpp server`, `Ollama`, or `vLLM`) for zero-cost, private, offline execution.
  - **Cloud Model**: Instant one-click toggle to **Google Gemini** (Gemini 3.8 Flash) for cloud-scale reasoning.

- 🎨 **Sleek Split-Pane Interface**:
  - Built with **Next.js 16**, **React 19**, and **Tailwind CSS**.
  - Features session management, multi-file chat context, markdown rendering with syntax highlighting, and responsive dark glassmorphism design.

---

## 🏛️ Architecture Overview

The system combines a reactive Next.js 16 split-pane interface with an asynchronous FastAPI backend orchestrating whisper.cpp and ChromaDB:

<p align="center">
  <img src="architecture.drawio.png" alt="System Architecture Diagram" width="100%" />
</p>

---

## 📁 Repository Structure

```
├── backend/
│   ├── main.py                  # FastAPI server with /upload and /query endpoints
│   ├── multimodal_processor.py  # PDF text extraction & video transcription orchestrator
│   ├── vector_store.py          # ChromaDB integration, embeddings, and balanced RAG logic
│   ├── speech2text/             # Standalone transcription pipeline
│   │   └── transcribe.sh        # ffmpeg audio extraction + whisper.cpp CLI runner
│   ├── uploads/                 # Temporary storage for ingested media files
│   ├── requirements.txt         # Python backend dependencies
│   └── .env.example             # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main layout & dual-pane viewer
│   │   │   ├── layout.tsx       # Root layout & font configuration
│   │   │   └── globals.css      # Design system & dark theme tokens
│   │   └── components/
│   │       ├── ChatInterface.tsx # Chat stream, citation badges, and session controls
│   │       └── PdfViewer.tsx    # PDF renderer with page-jump navigation
│   ├── package.json             # Next.js 16 dependencies
│   └── tsconfig.json            # TypeScript configuration
├── architecture.drawio.png      # System architecture diagram
├── architecture.drawio          # Editable Draw.io diagram source
├── Multimodal_demo.mp4          # Complete project demo walkthrough
├── .gitignore                   # Ignores large binaries, models, databases, and node_modules
├── .env.example                 # Root environment variable documentation
└── README.md                    # Project documentation
```

---

## 🛠️ Prerequisites

- **Python**: 3.10+
- **Node.js**: 18+ (Node 20 recommended) & `npm`
- **ffmpeg**: Installed and accessible in your system `PATH`
  ```bash
  sudo apt-get install ffmpeg
  ```
- **Whisper.cpp** *(optional if running speech-to-text)*:
  ```bash
  git clone https://github.com/ggerganov/whisper.cpp.git backend/speech2text/whisper.cpp
  cd backend/speech2text/whisper.cpp && cmake -B build -DWHISPER_CUDA=ON && cmake --build build --config Release
  ```

---

## ⚡ Quickstart Guide

### 1. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

Set your configuration in `.env` or `backend/.env`:
```env
LLM_BASE_URL="http://127.0.0.1:8080/v1"
GEMINI_API_KEY="your-optional-gemini-key"
```

### 2. Launch Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python main.py
```
The FastAPI backend will start at `http://localhost:8000`.

### 3. Launch Frontend
```bash
cd frontend
npm install
npm run dev
```
The Next.js client will start at `http://localhost:3000`.

---

## 🔌 API Reference

### `POST /upload`
Upload a PDF document or video file for processing, transcription, and vector embedding.
- **Parameters**: `file` (Multipart file), `session_id` (string)
- **Response**:
  ```json
  {
    "message": "Successfully processed demo.mp4",
    "chunks_added": 42,
    "url": "http://localhost:8000/uploads/demo.mp4"
  }
  ```

### `POST /query`
Submit a question against all documents indexed in the current session.
- **Body**:
  ```json
  {
    "query": "What is Python tuple unpacking?",
    "session_id": "session_abc123",
    "model": "local"
  }
  ```
- **Response**:
  ```json
  {
    "answer": "Tuple unpacking allows you to assign values from a sequence into distinct variables [1].",
    "citations": [
      {
        "id": 1,
        "type": "video",
        "source": "tutorial.mp4",
        "start_time": 142.5
      }
    ]
  }
  ```

---

## 💼 Portfolio & Freelance Demonstrations

This project was built to showcase enterprise-grade RAG engineering:
1. **Multimodal Ingestion**: Combining unstructured video audio streams with structured document pages.
2. **Deep Linking / Grounded Verification**: Ensuring hallucination-free responses through bidirectional UI citations that link directly to ground-truth frames and pages.
3. **Flexible LLM Runtime**: Seamless portability between on-premise local open-weights LLMs and cloud APIs.

---

## 🙏 Acknowledgments & Attributions

- **Educational Video Material**: The sample video used in the demonstration is from the excellent tutorial [**"Learn Python in Only 30 Minutes (Beginner Tutorial)"**](https://www.youtube.com/watch?v=Ro_MScTDfU4) by [**Indently**](https://www.youtube.com/@Indently). We gratefully credit Indently for creating and sharing this educational resource.
- **Speech-to-Text Model**: [Zero-STT Hinglish](https://huggingface.co/) and the high-performance C++ implementation by [whisper.cpp](https://github.com/ggerganov/whisper.cpp).

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
