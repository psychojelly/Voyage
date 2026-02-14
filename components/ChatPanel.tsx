'use client';

import { useState, useRef, useEffect } from 'react';
import type { DayRecord } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  healthContext?: DayRecord | null;
}

export default function ChatPanel({ open, onClose, healthContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          healthContext: healthContext ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: `Error: ${data.error || 'Something went wrong'}` },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: data.reply },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Error: Could not reach the server.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className={`chat-overlay${open ? ' active' : ''}`} onClick={onClose} />
      <div className={`chat-panel${open ? ' open' : ''}`}>
        <div className="chat-header">
          <h2>Chat</h2>
          {healthContext && <span className="chat-context-badge">Health data active</span>}
          <button className="icon-btn" aria-label="Close chat" onClick={onClose}>&times;</button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div className="chat-empty">
              Ask me anything{healthContext ? ' about your health data' : ''}!
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              <div className="chat-msg-bubble">{msg.text}</div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant">
              <div className="chat-msg-bubble chat-loading">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-bar">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
