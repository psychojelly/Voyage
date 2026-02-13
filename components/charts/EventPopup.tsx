'use client';

import type { HealthEvent, EventCategory } from '@/lib/types';
import { CATEGORY_COLORS } from './eventMarkerPlugin';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  activity: 'Activity',
  sleep: 'Sleep',
  'health-note': 'Health Note',
  custom: 'Calendar',
  experience: 'Experience',
};

interface EventPopupProps {
  event: HealthEvent;
  x: number;
  y: number;
  containerRect: DOMRect;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  readOnly?: boolean;
}

export default function EventPopup({ event, x, y, containerRect, onEdit, onDelete, onClose, readOnly }: EventPopupProps) {
  const color = event.color || CATEGORY_COLORS[event.category] || '#dfe6e9';

  // Position relative to the container, clamped to bounds
  const popupWidth = 240;
  const popupHeight = 160;
  let left = x - containerRect.left - popupWidth / 2;
  let top = y - containerRect.top + 12;

  // Clamp horizontally
  if (left < 4) left = 4;
  if (left + popupWidth > containerRect.width - 4) left = containerRect.width - popupWidth - 4;
  // If too close to bottom, show above
  if (top + popupHeight > containerRect.height - 4) {
    top = y - containerRect.top - popupHeight - 12;
  }

  return (
    <>
      <div className="event-popup-overlay" onClick={onClose} />
      <div className="event-popup" style={{ left, top }}>
        <div className="event-popup-header">
          <span className="event-category-badge" style={{ background: color }}>{CATEGORY_LABELS[event.category] || event.category}</span>
          <span className="event-popup-time">
            {event.time}
            {event.endTime && ` – ${event.endTime}`}
            {event.durationMin != null && (
              <span className="event-popup-duration">
                {event.durationMin >= 60
                  ? ` (${Math.floor(event.durationMin / 60)}h${event.durationMin % 60 ? ` ${event.durationMin % 60}m` : ''})`
                  : ` (${event.durationMin}m)`}
              </span>
            )}
          </span>
          <button className="event-popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="event-popup-title">{event.title}</div>
        {event.category === 'experience' && event.room && (
          <div className="event-popup-room">{event.room.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
        )}
        {event.description && <div className="event-popup-desc">{event.description}</div>}
        {event.isAuto && event.id.startsWith('gcal-') && (
          <span className="event-auto-badge event-gcal-badge">Google Calendar</span>
        )}
        {event.isAuto && !event.id.startsWith('gcal-') && (
          <span className="event-auto-badge">Auto-detected</span>
        )}
        {!event.isAuto && !readOnly && (
          <div className="event-popup-actions">
            <button onClick={onEdit}>Edit</button>
            <button onClick={onDelete} className="event-popup-delete">Delete</button>
          </div>
        )}
      </div>
    </>
  );
}
