"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatInterface from '@/components/ChatInterface';

// react-pdf uses browser APIs — must be client-only
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });

interface Session {
  id: string;
  name: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'pdf' | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'local' | 'gemini'>('local');

  // For PDF citation page jumps
  const [pdfTargetPage, setPdfTargetPage] = useState<number | undefined>(undefined);

  useEffect(() => {
    const savedSessions = localStorage.getItem('poc_sessions');
    let loadedSessions = savedSessions ? JSON.parse(savedSessions) : [];

    if (loadedSessions.length === 0) {
      const newSession = { id: Math.random().toString(36).substring(7), name: 'New Chat' };
      loadedSessions = [newSession];
      localStorage.setItem('poc_sessions', JSON.stringify(loadedSessions));
    }
    setSessions(loadedSessions);

    const savedActive = localStorage.getItem('poc_active_session');
    if (savedActive && loadedSessions.find((s: Session) => s.id === savedActive)) {
      setActiveSessionId(savedActive);
    } else {
      setActiveSessionId(loadedSessions[0].id);
    }

    const savedModel = localStorage.getItem('poc_model');
    if (savedModel) setSelectedModel(savedModel as 'local' | 'gemini');
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    localStorage.setItem('poc_active_session', activeSessionId);

    const savedUrl = localStorage.getItem(`poc_mediaUrl_${activeSessionId}`);
    const savedType = localStorage.getItem(`poc_mediaType_${activeSessionId}`);
    const savedMsgs = localStorage.getItem(`poc_messages_${activeSessionId}`);

    setMediaUrl(savedUrl || null);
    setMediaType((savedType as 'video' | 'pdf') || null);
    setHasMessages(!!savedMsgs);
    setPdfTargetPage(undefined); // reset page jump on session change
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    if (mediaUrl) localStorage.setItem(`poc_mediaUrl_${activeSessionId}`, mediaUrl);
    if (mediaType) localStorage.setItem(`poc_mediaType_${activeSessionId}`, mediaType);
  }, [mediaUrl, mediaType, activeSessionId]);

  const handleNewSession = () => {
    const newSession = { id: Math.random().toString(36).substring(7), name: `Chat ${sessions.length + 1}` };
    const updated = [...sessions, newSession];
    setSessions(updated);
    localStorage.setItem('poc_sessions', JSON.stringify(updated));
    setActiveSessionId(newSession.id);
  };

  const handleClearSession = () => {
    if (!activeSessionId) return;
    localStorage.removeItem(`poc_mediaUrl_${activeSessionId}`);
    localStorage.removeItem(`poc_mediaType_${activeSessionId}`);
    localStorage.removeItem(`poc_messages_${activeSessionId}`);
    setMediaUrl(null);
    setMediaType(null);
    setHasMessages(false);
    setPdfTargetPage(undefined);
  };

  const handleModelToggle = (model: 'local' | 'gemini') => {
    setSelectedModel(model);
    localStorage.setItem('poc_model', model);
  };

  const handleSessionRename = (name: string) => {
    if (!activeSessionId) return;
    const updated = sessions.map(s =>
      s.id === activeSessionId ? { ...s, name } : s
    );
    setSessions(updated);
    localStorage.setItem('poc_sessions', JSON.stringify(updated));
  };

  const handleCitationClick = (time?: number, page?: number, sourceUrl?: string, type?: 'video' | 'pdf') => {
    if (sourceUrl && type) {
      const cleanSourceUrl = sourceUrl.split('#')[0];
      const currentCleanUrl = mediaUrl?.split('#')[0];

      if (cleanSourceUrl !== currentCleanUrl) {
        setMediaUrl(cleanSourceUrl);
        setMediaType(type);
      }

      setTimeout(() => {
        if (type === 'video' && time !== undefined) {
          const video = document.getElementById('media-player') as HTMLVideoElement;
          if (video) {
            video.currentTime = time;
            video.play();
          }
        } else if (type === 'pdf' && page !== undefined) {
          // Jump to the cited page inside our PdfViewer
          setPdfTargetPage(page);
        }
      }, 150);
    }
  };

  return (
    <main className="flex h-screen bg-[#0a0a0a] text-gray-200 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Left Pane: Media Viewer */}
      <div className="flex-1 bg-[#1a1a1e] relative flex flex-col overflow-hidden">
        {/* Top bar — session selector only, no model toggle clash */}
        <div className="flex items-center gap-3 px-4 py-3 bg-black/30 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-300 text-xs font-medium tracking-wider uppercase bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Multimodal RAG
          </div>

          <div className="flex items-center gap-2 bg-black/40 rounded-full border border-white/10 px-2 py-1 ml-auto">
            <select
              value={activeSessionId || ''}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="bg-transparent text-gray-200 text-sm outline-none cursor-pointer"
            >
              {sessions.map(s => <option key={s.id} value={s.id} className="bg-gray-800 text-gray-100">{s.name}</option>)}
            </select>
            <button
              onClick={handleNewSession}
              className="text-xs bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white px-2 py-1 rounded-full transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Media area */}
        <div className="flex-1 overflow-hidden flex justify-center items-center p-4">
          {!mediaUrl ? (
            <div
              className="flex flex-col items-center gap-5 text-center cursor-pointer group transition-all"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="w-24 h-24 rounded-3xl bg-white/5 group-hover:bg-blue-600/15 text-gray-300 group-hover:text-blue-400 flex items-center justify-center border border-white/10 group-hover:border-blue-500/40 shadow-lg group-hover:scale-105 transition-all duration-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <p className="text-lg font-medium text-gray-200 group-hover:text-white transition-colors">
                  Click here or the chat panel to upload media
                </p>
                <p className="text-xs text-gray-400">
                  Supports PDF documents and MP4/WebM videos
                </p>
              </div>
            </div>
          ) : mediaType === 'video' ? (
            <video
              id="media-player"
              src={mediaUrl}
              controls
              className="w-full max-h-full rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 transition-all"
            />
          ) : (
            <PdfViewer url={mediaUrl} targetPage={pdfTargetPage} />
          )}
        </div>
      </div>

      {/* Right Pane: Chat Interface */}
      <div className="w-1/2 flex flex-col bg-[#0a0a0a] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20">
        <ChatInterface
          sessionId={activeSessionId}
          model={selectedModel}
          onModelToggle={handleModelToggle}
          onClearSession={handleClearSession}
          hasMedia={!!mediaUrl || hasMessages}
          onFileUpload={(file, type, url) => {
            setMediaFile(file);
            setMediaType(type);
            setMediaUrl(url);
            setPdfTargetPage(undefined);
          }}
          onCitationClick={handleCitationClick}
          onSessionRename={handleSessionRename}
        />
      </div>
    </main>
  );
}
