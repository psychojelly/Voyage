'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { HealthEvent, EventCategory } from '@/lib/types';

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'health-note', label: 'Health Note' },
  { value: 'experience', label: 'Experience' },
];

const ROOMS = [
  { value: 'room-1', label: 'Room 1' },
  { value: 'room-2', label: 'Room 2' },
  { value: 'room-3', label: 'Room 3' },
  { value: 'room-4', label: 'Room 4' },
];

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent {
  error: string;
}
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function currentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface EventFormProps {
  initial?: HealthEvent | null;
  dreamMode?: boolean;
  onSave: (event: HealthEvent) => void;
  onCancel: () => void;
}

export default function EventForm({ initial, dreamMode, onSave, onCancel }: EventFormProps) {
  const [time, setTime] = useState(initial?.time || (dreamMode ? currentTimeStr() : ''));
  const [endTime, setEndTime] = useState(initial?.endTime || '');
  const [title, setTitle] = useState(initial?.title || (dreamMode ? 'Dream' : ''));
  const [category, setCategory] = useState<EventCategory>(initial?.category || (dreamMode ? 'sleep' : 'activity'));
  const [description, setDescription] = useState(initial?.description || '');
  const [room, setRoom] = useState(initial?.room || 'room-1');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    setTime(initial?.time || (dreamMode ? currentTimeStr() : ''));
    setEndTime(initial?.endTime || '');
    setTitle(initial?.title || (dreamMode ? 'Dream' : ''));
    setCategory(initial?.category || (dreamMode ? 'sleep' : 'activity'));
    setDescription(initial?.description || '');
    setRoom(initial?.room || 'room-1');
  }, [initial, dreamMode]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', e.error);
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setTranscript('');
    setIsRecording(true);
    recognition.start();
  }, [stopRecording]);

  // Auto-start recording in dream mode
  useEffect(() => {
    if (dreamMode && speechSupported && !autoStarted.current) {
      autoStarted.current = true;
      startRecording();
    }
  }, [dreamMode, speechSupported, startRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Apply transcript to description
  const applyTranscript = useCallback(() => {
    if (!transcript.trim()) return;
    const text = transcript.trim();
    setDescription(prev => prev ? `${prev} ${text}` : text);
    setTranscript('');
  }, [transcript]);

  // Compute duration in minutes from start/end times
  function computeDuration(start: string, end: string): number | undefined {
    if (!start || !end) return undefined;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60; // crosses midnight
    return diff;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !title) return;
    onSave({
      id: initial?.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time,
      title,
      category,
      description: description || undefined,
      endTime: endTime || undefined,
      durationMin: computeDuration(time, endTime),
      room: category === 'experience' ? room : undefined,
    });
  };

  // Dream mode: streamlined layout
  if (dreamMode) {
    return (
      <form className="event-form event-form-dream" onSubmit={handleSubmit}>
        <div className="event-form-dream-header">
          <span className="event-form-dream-icon">🌙</span>
          <span className="event-form-dream-title">Dream Recording</span>
          <span className="event-form-dream-time">{time}</span>
        </div>

        <div className="event-form-voice event-form-voice-prominent">
          <button
            type="button"
            className={`event-form-mic event-form-mic-lg ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop recording' : 'Record dream'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
          {isRecording && <span className="event-form-recording-label">Listening...</span>}
          {!isRecording && !transcript && !description && (
            <span className="event-form-dream-hint">Tap to describe your dream</span>
          )}
        </div>

        {transcript && (
          <div className="event-form-transcript">
            <span className="event-form-transcript-text">{transcript}</span>
            <button type="button" className="event-form-transcript-apply" onClick={applyTranscript}>
              Apply
            </button>
          </div>
        )}

        <label>
          Description
          <textarea
            className="event-form-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Your dream description will appear here..."
            rows={4}
          />
        </label>

        <div className="event-form-actions">
          <button type="submit" className="event-form-save" disabled={!description.trim()}>Save Dream</button>
          <button type="button" className="event-form-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    );
  }

  // Normal event form
  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <div className="event-form-row">
        <label>
          Start
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </label>
        <label>
          End
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </label>
        <label>
          Category
          <select value={category} onChange={e => setCategory(e.target.value as EventCategory)}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        {category === 'experience' && (
          <label>
            Room
            <select value={room} onChange={e => setRoom(e.target.value)}>
              {ROOMS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        Title
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Morning run" />
      </label>
      <label>
        Description <span className="event-form-optional">(optional)</span>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details..." />
      </label>

      {speechSupported && (
        <div className="event-form-voice">
          <button
            type="button"
            className={`event-form-mic ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
          {isRecording && <span className="event-form-recording-label">Listening...</span>}
          {transcript && (
            <div className="event-form-transcript">
              <span className="event-form-transcript-text">{transcript}</span>
              <button type="button" className="event-form-transcript-apply" onClick={applyTranscript}>
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      <div className="event-form-actions">
        <button type="submit" className="event-form-save">Save</button>
        <button type="button" className="event-form-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
