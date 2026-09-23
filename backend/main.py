from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os

from multimodal_processor import process_video, process_pdf
from vector_store import add_chunks, query_rag

app = FastAPI(title="Multimodal RAG POC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

class QueryRequest(BaseModel):
    query: str
    session_id: str
    model: str = "local"

@app.post("/upload")
def upload_document(file: UploadFile = File(...), session_id: str = Form(...)):
    try:
        file_location = f"uploads/{file.filename}"
        with open(file_location, "wb+") as file_object:
            file_object.write(file.file.read())

        chunks = []
        if file.filename.lower().endswith('.pdf'):
            chunks = process_pdf(file_location, file.filename)
        elif file.filename.lower().endswith('.mp4'):
            chunks = process_video(file_location, file.filename)
            
        if chunks:
            add_chunks(chunks, session_id)
            
        static_url = f"http://localhost:8000/uploads/{file.filename}"
        return {"message": f"Successfully processed {file.filename}", "chunks_added": len(chunks), "url": static_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
def query_endpoint(request: QueryRequest):
    try:
        result = query_rag(request.query, request.session_id, request.model)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
