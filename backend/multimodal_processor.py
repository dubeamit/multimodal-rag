import subprocess
import os
import re
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def get_transcribe_script():
    env_script = os.environ.get("TRANSCRIPTION_SCRIPT_PATH")
    if env_script and os.path.exists(env_script):
        return env_script

    base_dir = os.path.dirname(os.path.abspath(__file__))
    local_script = os.path.join(base_dir, "speech2text", "transcribe.sh")
    if os.path.exists(local_script):
        return local_script

    fallback_script = "/home/amit/projects/speech2text/demo_transcribe.sh"
    if os.path.exists(fallback_script):
        return fallback_script

    raise FileNotFoundError("Could not find transcribe.sh. Please set TRANSCRIPTION_SCRIPT_PATH.")

def process_video(file_path, filename):
    script_path = get_transcribe_script()
    abs_file_path = os.path.abspath(file_path)
    output_dir = os.path.dirname(abs_file_path)
    
    print(f"Running STT on {abs_file_path} using {script_path}...")
    try:
        subprocess.run([script_path, abs_file_path, output_dir], check=True, capture_output=True, text=True)
        print("STT Script finished.")
    except subprocess.CalledProcessError as e:
        print(f"Error running transcription: {e.stderr}")
        raise Exception("Transcription failed.")
        
    basename = os.path.splitext(os.path.basename(file_path))[0]
    transcript_file = f"{basename}_transcript.txt"
    
    if not os.path.exists(transcript_file):
        transcript_file = f"uploads/{basename}_transcript.txt"
        
    if not os.path.exists(transcript_file):
        raise Exception(f"Transcript file {transcript_file} not found after processing.")
        
    with open(transcript_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    pattern = re.compile(r'\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)')
    chunks = []
    
    for line in content.split('\n'):
        match = pattern.match(line.strip())
        if match:
            s_time, e_time, text = match.group(1), match.group(2), match.group(3)
            def time_to_sec(t):
                h, m, s = t.split(':')
                return int(h) * 3600 + int(m) * 60 + float(s)
                
            chunks.append({
                "text": text,
                "metadata": {
                    "source": filename,
                    "type": "video",
                    "start_time": time_to_sec(s_time),
                    "end_time": time_to_sec(e_time)
                }
            })
            
    return chunks


def process_pdf(file_path, filename):
    print(f"Starting PDF extraction for {filename}...")
    reader = PdfReader(file_path)
    chunks = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    total_pages = len(reader.pages)
    for i, page in enumerate(reader.pages):
        if (i+1) % 5 == 0 or i == 0 or i == total_pages - 1:
             print(f"Extracting text from page {i+1}/{total_pages}...")
        text = page.extract_text()
        if text:
            page_chunks = text_splitter.split_text(text)
            for chunk in page_chunks:
                chunks.append({
                    "text": chunk,
                    "metadata": {
                        "source": filename,
                        "type": "pdf",
                        "page_number": i + 1
                    }
                })
    return chunks
