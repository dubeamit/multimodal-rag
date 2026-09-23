"use client";
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
    sessionId: string | null;
    model: 'local' | 'gemini';
    onModelToggle: (model: 'local' | 'gemini') => void;
    onClearSession: () => void;
    hasMedia: boolean;
    onFileUpload: (file: File, type: 'video' | 'pdf', url: string) => void;
    onCitationClick: (time?: number, page?: number, sourceUrl?: string, type?: 'video' | 'pdf') => void;
    onSessionRename?: (name: string) => void;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    citations?: any[];
}

// ── Citation helpers ──────────────────────────────────────────────────────────

/** Normalise every citation variant the LLM might emit into [N] form.
 *  Handles: [Citation 1], [Citation 1, 9], [1, 9], [1,9] */
function normalizeCitations(content: string): string {
    // [Citation 3, 6] or [Citation 3,6] → [3] [6]
    content = content.replace(/\[Citation\s+(\d+(?:\s*,\s*\d+)*)\]/g, (_m, ids) =>
        ids.split(',').map((id: string) => `[${id.trim()}]`).join(' ')
    );
    // [3, 6] or [1,9] (bare numbers list) → [3] [6]
    content = content.replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_m, ids) =>
        ids.split(',').map((id: string) => `[${id.trim()}]`).join(' ')
    );
    return content;
}

/** Inject clickable citation buttons into a plain string. */
function splitByCitations(
    text: string,
    citations: any[],
    onCitationClick: ChatInterfaceProps['onCitationClick'],
    keyPrefix: string
): React.ReactNode[] {
    let parts: React.ReactNode[] = [text];

    citations.forEach(cit => {
        const marker = `[${cit.id}]`;
        const next: React.ReactNode[] = [];

        parts.forEach((part, idx) => {
            if (typeof part !== 'string') { next.push(part); return; }
            const segments = part.split(marker);
            segments.forEach((seg, i) => {
                if (seg) next.push(seg);
                if (i < segments.length - 1) {
                    next.push(
                        <button
                            key={`${keyPrefix}-c${cit.id}-${idx}-${i}`}
                            title={cit.type === 'pdf'
                                ? `📄 Jump to page ${cit.page_number}`
                                : `🎬 Jump to ${cit.start_time}s`}
                            onClick={() => cit.type === 'video'
                                ? onCitationClick(cit.start_time, undefined, `http://localhost:8000/uploads/${cit.source}`, 'video')
                                : onCitationClick(undefined, cit.page_number, `http://localhost:8000/uploads/${cit.source}`, 'pdf')}
                            className={`inline-flex items-center justify-center w-[1.1rem] h-[1.1rem] mx-0.5 text-[10px] font-bold rounded-full transition-all align-middle ${
                                cit.type === 'video'
                                    ? 'bg-blue-500/25 text-blue-300 hover:bg-blue-500 hover:text-white shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                                    : 'bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500 hover:text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                            }`}
                        >
                            {cit.id}
                        </button>
                    );
                }
            });
        });

        parts = next;
    });

    return parts;
}

/** Recursively walk react-markdown's React children, injecting citation buttons
 *  into every string leaf.  Handles strings, arrays and React elements. */
function injectCitations(
    node: React.ReactNode,
    citations: any[],
    onCitationClick: ChatInterfaceProps['onCitationClick'],
    key = 'r'
): React.ReactNode {
    if (typeof node === 'string') {
        const pieces = splitByCitations(node, citations, onCitationClick, key);
        return pieces.length === 1 && typeof pieces[0] === 'string'
            ? pieces[0]
            : <React.Fragment key={key}>{pieces}</React.Fragment>;
    }
    if (Array.isArray(node)) {
        return node.map((n, i) => injectCitations(n, citations, onCitationClick, `${key}-${i}`));
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        const el = node as React.ReactElement<{ children?: React.ReactNode }>;
        const newChildren = injectCitations(el.props.children, citations, onCitationClick, `${key}-ch`);
        return React.cloneElement(el, { key }, newChildren);
    }
    return node;
}

// ── Markdown component overrides ──────────────────────────────────────────────

function makeMarkdownComponents(citations: any[], onCitationClick: ChatInterfaceProps['onCitationClick']) {
    const wrap = (children: React.ReactNode, k: string) =>
        injectCitations(children, citations, onCitationClick, k);

    return {
        // Use div instead of p — <p> cannot contain block elements like <pre>
        p: ({ children, ...props }: any) => (
            <div className="mb-3 last:mb-0 leading-relaxed" {...props}>
                {wrap(children, 'p')}
            </div>
        ),
        // Headings
        h1: ({ children, ...props }: any) => (
            <h1 className="text-lg font-semibold text-white mt-5 mb-2 border-b border-white/10 pb-1" {...props}>
                {wrap(children, 'h1')}
            </h1>
        ),
        h2: ({ children, ...props }: any) => (
            <h2 className="text-base font-semibold text-white/90 mt-4 mb-2" {...props}>
                {wrap(children, 'h2')}
            </h2>
        ),
        h3: ({ children, ...props }: any) => (
            <h3 className="text-sm font-semibold text-white/80 mt-3 mb-1.5 uppercase tracking-wide" {...props}>
                {wrap(children, 'h3')}
            </h3>
        ),
        h4: ({ children, ...props }: any) => (
            <h4 className="text-sm font-medium text-white/70 mt-3 mb-1" {...props}>
                {wrap(children, 'h4')}
            </h4>
        ),
        // pre: intercept all fenced code blocks.
        // Single-line blocks with no language label → downgrade to inline chip.
        // Multi-line or language-labelled → full dark code box.
        pre: ({ children }: any) => {
            const child = React.Children.toArray(children)[0] as React.ReactElement<any>;
            const lang = /language-(\w+)/.exec(child?.props?.className || '')?.[1] ?? '';
            const content = String(child?.props?.children ?? '').trimEnd();
            const isSingleLine = !content.includes('\n');

            if (!lang && isSingleLine) {
                // Render as an inline-style chip — same look as single backtick
                return (
                    <code className="bg-white/10 text-emerald-300 text-[0.8em] font-mono px-1.5 py-0.5 rounded mx-0.5">
                        {content}
                    </code>
                );
            }

            return (
                <div className="my-3 rounded-xl overflow-hidden border border-white/10">
                    {lang && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/60 border-b border-white/10">
                            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{lang}</span>
                        </div>
                    )}
                    <pre className="bg-[#0d1117] p-4 overflow-x-auto">
                        {children}
                    </pre>
                </div>
            );
        },
        // code: handles true inline backtick code (not inside a pre block)
        code: ({ className, children, ...props }: any) => (
            <code
                className={className
                    ? 'text-[0.8em] font-mono text-emerald-300 leading-relaxed whitespace-pre'
                    : 'bg-white/10 text-emerald-300 text-[0.8em] font-mono px-1.5 py-0.5 rounded'
                }
                {...props}
            >
                {children}
            </code>
        ),
        // Lists
        ul: ({ children, ...props }: any) => (
            <ul className="list-none space-y-1 my-2" {...props}>
                {children}
            </ul>
        ),
        ol: ({ children, ...props }: any) => (
            <ol className="list-decimal list-inside space-y-1 my-2 pl-1" {...props}>
                {children}
            </ol>
        ),
        li: ({ children, ...props }: any) => (
            <li className="flex gap-2 items-start text-gray-300" {...props}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/60 flex-shrink-0" />
                <span>{wrap(children, 'li')}</span>
            </li>
        ),
        // Emphasis
        strong: ({ children, ...props }: any) => (
            <strong className="font-semibold text-white" {...props}>
                {wrap(children, 'strong')}
            </strong>
        ),
        em: ({ children, ...props }: any) => (
            <em className="italic text-gray-300" {...props}>
                {wrap(children, 'em')}
            </em>
        ),
        // Blockquote
        blockquote: ({ children, ...props }: any) => (
            <blockquote
                className="border-l-2 border-blue-500/50 pl-4 py-1 my-3 text-gray-400 bg-white/3 rounded-r-lg"
                {...props}
            >
                {children}
            </blockquote>
        ),
        // HR
        hr: () => <hr className="border-white/10 my-4" />,
        // Links
        a: ({ children, href, ...props }: any) => (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                {...props}
            >
                {children}
            </a>
        ),
    };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatInterface({
    sessionId,
    model,
    onModelToggle,
    onClearSession,
    hasMedia,
    onFileUpload,
    onCitationClick,
    onSessionRename,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasRenamedRef = useRef(false);

    useEffect(() => {
        if (!sessionId) return;
        hasRenamedRef.current = false; // reset on session switch
        const saved = localStorage.getItem(`poc_messages_${sessionId}`);
        if (saved) {
            try { setMessages(JSON.parse(saved)); }
            catch (e) { setMessages([]); }
        } else {
            setMessages([]);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || messages.length === 0) return;
        localStorage.setItem(`poc_messages_${sessionId}`, JSON.stringify(messages));
    }, [messages, sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-name session from first user message if not yet renamed
    const maybeRenameFromQuery = (query: string) => {
        if (hasRenamedRef.current || !onSessionRename) return;
        hasRenamedRef.current = true;
        const words = query.trim().split(/\s+/).slice(0, 5).join(' ');
        onSessionRename(words.length > 40 ? words.slice(0, 40) + '…' : words);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !sessionId) return;
        const file = e.target.files[0];
        const type = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'video';

        // Auto-name session from filename
        if (!hasRenamedRef.current && onSessionRename) {
            hasRenamedRef.current = true;
            const cleanName = file.name
                .replace(/\.[^.]+$/, '')          // strip extension
                .replace(/[_-]+/g, ' ')            // underscores → spaces
                .replace(/\s{2,}/g, ' ')
                .trim()
                .slice(0, 45);
            onSessionRename(cleanName);
        }

        setIsUploading(true);
        setUploadProgress(5);
        const interval = setInterval(() => {
            setUploadProgress(prev => prev >= 90 ? prev : prev + Math.floor(Math.random() * 5) + 2);
        }, 1000);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', sessionId);

        try {
            const res = await fetch('http://localhost:8000/upload', { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                onFileUpload(file, type, data.url);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `**${file.name}** processed successfully — ${data.chunks_added} chunks indexed.\n\nAsk me anything about it!`,
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Error processing file.' }]);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Make sure the backend is running.' }]);
        } finally {
            clearInterval(interval);
            setUploadProgress(100);
            setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 800);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !sessionId) return;
        const userMsg = input.trim();
        maybeRenameFromQuery(userMsg);
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsThinking(true);

        try {
            const res = await fetch('http://localhost:8000/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg, session_id: sessionId, model }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.answer,
                citations: data.citations,
            }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with backend.' }]);
        }
        setIsThinking(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#111] bg-gradient-to-b from-[#151515] to-[#0a0a0a]">

            {/* ── Header ── */}
            <div className="px-4 pt-4 pb-3 border-b border-white/10 backdrop-blur-md bg-black/20 sticky top-0 z-20 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-medium text-white">Assistant</h2>
                    <div className="relative">
                        <input type="file" id="file-upload" className="hidden" onChange={handleUpload} accept="video/*,.pdf" />
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full text-sm font-medium text-gray-200 hover:text-white transition-all flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-95"
                        >
                            {isUploading
                                ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                : <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            }
                            Upload
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex bg-black/40 rounded-full border border-white/10 p-1">
                        <button
                            onClick={() => onModelToggle('local')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${model === 'local' ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]' : 'text-gray-400 hover:text-white'}`}
                        >Local</button>
                        <button
                            onClick={() => onModelToggle('gemini')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${model === 'gemini' ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]' : 'text-gray-400 hover:text-white'}`}
                        >Gemini</button>
                    </div>
                    {hasMedia && (
                        <button
                            onClick={onClearSession}
                            className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-full transition-all border border-red-500/20"
                        >Clear Session</button>
                    )}
                </div>
            </div>

            {/* ── Upload progress ── */}
            {isUploading && (
                <div className="w-full bg-white/5 h-0.5 relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
            )}

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scroll-smooth">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-4 select-none">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                            <p className="text-base font-medium text-gray-200">
                                Upload a PDF or video, then ask anything.
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Click a{' '}
                                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 mx-0.5 align-middle">1</span>
                                {' '}citation badge to jump to that exact page or timestamp.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 mr-2 mt-1 flex items-center justify-center text-white text-[9px] font-bold shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                                AI
                            </div>
                        )}
                        <div className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-sm ${
                            msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none shadow-[0_4px_20px_rgba(37,99,235,0.3)]'
                                : 'bg-[#1e1e24] text-gray-100 border border-white/10 rounded-bl-none shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                        }`}>
                            {msg.role === 'assistant' ? (
                                <div className="prose-invert leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={makeMarkdownComponents(msg.citations || [], onCitationClick) as any}
                                    >
                                        {normalizeCitations(msg.content)}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="leading-relaxed">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex justify-start animate-in fade-in">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 mr-2 mt-1" />
                        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl rounded-bl-none px-5 py-4 flex items-center gap-1.5">
                            {[0, 0.15, 0.3].map((delay, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                                    style={{ animationDelay: `${delay}s` }}
                                />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/10">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Ask about the document…"
                        className="w-full bg-white/10 border border-white/15 rounded-full pl-5 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-white placeholder-gray-400 font-normal text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="absolute right-2 p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all disabled:opacity-40 disabled:hover:bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.35)] active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
