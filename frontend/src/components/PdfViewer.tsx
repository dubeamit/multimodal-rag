"use client";
import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker to use local bundled worker in public/ directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
  url: string;
  targetPage?: number; // when this changes, jump to that page
}

export default function PdfViewer({ url, targetPage }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [loadError, setLoadError] = useState<string | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainerWidth(node.clientWidth - 48);
  }, []);

  // Jump to page when citation is clicked
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF load error:", err);
    setLoadError(err.message || "NetworkError when attempting to fetch resource.");
  };

  const goTo = (page: number) => {
    const clamped = Math.max(1, Math.min(page, numPages));
    setCurrentPage(clamped);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full overflow-hidden"
    >
      {/* PDF Controls toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10 flex-shrink-0">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-30 transition-all text-white text-sm"
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5 text-gray-200 text-xs">
            <input
              type="number"
              value={currentPage}
              min={1}
              max={numPages}
              onChange={(e) => goTo(Number(e.target.value))}
              className="w-10 text-center bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none focus:border-blue-500/50"
            />
            <span className="text-gray-300">/ {numPages}</span>
          </div>
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-30 transition-all text-white text-sm"
          >
            ›
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-all text-white text-sm"
          >
            −
          </button>
          <span className="text-gray-300 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.1))}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-all text-white text-sm"
          >
            +
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="text-xs text-gray-400 hover:text-white ml-1 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Page jump flash indicator */}
      {targetPage && targetPage === currentPage && (
        <div className="flex-shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-emerald-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Jumped to citation — page {targetPage}
        </div>
      )}

      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex justify-center items-start py-4 bg-[#1a1a1e]">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center gap-3 text-gray-300 mt-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm">Loading PDF…</span>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center gap-3 text-red-400 mt-20 text-sm max-w-sm text-center p-6 bg-red-500/10 border border-red-500/20 rounded-2xl mx-auto">
              <svg className="w-9 h-9 text-red-400 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-1">
                <p className="font-medium text-gray-200">Unable to load document</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {loadError || "The document could not be retrieved from the server."}
                </p>
              </div>
              <button
                onClick={() => document.getElementById('file-upload')?.click()}
                className="mt-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-medium transition-all"
              >
                Upload a new file
              </button>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            width={containerWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-[0_4px_30px_rgba(0,0,0,0.6)] rounded"
          />
        </Document>
      </div>
    </div>
  );
}
