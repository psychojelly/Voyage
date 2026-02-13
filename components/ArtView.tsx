'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DayRecord } from '@/lib/types';

interface ArtViewProps {
  data: DayRecord[];
  focusDay: DayRecord | null;
  prevDay?: DayRecord | null;
}

export default function ArtView({ data, focusDay, prevDay }: ArtViewProps) {
  return (
    <div className="art-view">
      <SleepArt data={data} focusDay={focusDay} prevDay={prevDay} />
      <HeartArt data={data} focusDay={focusDay} />
      <ActivityArt data={data} focusDay={focusDay} />
      <StressArt data={data} focusDay={focusDay} />
    </div>
  );
}

/* ── Shared helpers ────────────────────────────────────── */

function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const lastSize = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const start = performance.now();
    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      // Resize canvas buffer when CSS size changes
      if (w !== lastSize.current.w || h !== lastSize.current.h) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastSize.current = { w, h };
      }

      if (w > 0 && h > 0) {
        drawRef.current(ctx, w, h, (performance.now() - start) / 1000);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return canvasRef;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ── Sleep: planets (REM), moons (Deep), stars (Light) ── */
// Seeded PRNG so positions are stable across frames for a given day.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function SleepArt({ focusDay, prevDay }: { data: DayRecord[]; focusDay: DayRecord | null; prevDay?: DayRecord | null }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const sleepDay = prevDay?.sleep ? prevDay : focusDay;
    const sleep = sleepDay?.sleep;

    const deep = sleep?.deep_min ?? 45;
    const rem = sleep?.rem_min ?? 60;
    const light = sleep?.light_min ?? 180;
    const awake = sleep?.awake_min ?? 15;
    const efficiency = sleep?.efficiency ?? 80;

    // Seed from date string for stable positions
    const dateStr = sleepDay?.date ?? 'default';
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) seed = seed * 31 + dateStr.charCodeAt(i);
    const rng = seededRandom(Math.abs(seed) + 1);

    // Background — darker = better sleep
    const bgBright = lerp(8, 20, 1 - efficiency / 100);
    ctx.fillStyle = `rgb(${bgBright}, ${bgBright * 0.7}, ${bgBright * 1.5})`;
    ctx.fillRect(0, 0, w, h);

    // --- Light sleep = twinkling stars ---
    const starCount = Math.max(15, Math.round(light / 3));
    for (let i = 0; i < starCount; i++) {
      const sx = rng() * w;
      const sy = rng() * h;
      const baseSize = 0.5 + rng() * 1.5;
      const twinkle = 0.4 + 0.6 * Math.sin(t * (1.5 + rng() * 2) + i * 7.3);
      const alpha = twinkle * (0.5 + rng() * 0.5);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b8c6db';
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize, 0, Math.PI * 2);
      ctx.fill();

      // Cross sparkle on brighter stars
      if (baseSize > 1) {
        ctx.globalAlpha = alpha * 0.3;
        ctx.strokeStyle = '#d0d8e8';
        ctx.lineWidth = 0.5;
        const len = baseSize * 3 * twinkle;
        ctx.beginPath();
        ctx.moveTo(sx - len, sy);
        ctx.lineTo(sx + len, sy);
        ctx.moveTo(sx, sy - len);
        ctx.lineTo(sx, sy + len);
        ctx.stroke();
      }
    }

    // --- Deep sleep = crescent moons ---
    const moonCount = Math.max(1, Math.round(deep / 20));
    for (let i = 0; i < moonCount; i++) {
      const mx = w * 0.15 + rng() * w * 0.7;
      const my = h * 0.15 + rng() * h * 0.7;
      const radius = 10 + rng() * 18;
      const drift = Math.sin(t * 0.3 + i * 2.5) * 4;
      const bobY = my + drift;

      // Moon body
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#4a90d9';
      ctx.beginPath();
      ctx.arc(mx, bobY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Crescent shadow (offset circle to create crescent)
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${bgBright}, ${bgBright * 0.7}, ${bgBright * 1.5})`;
      ctx.beginPath();
      ctx.arc(mx + radius * 0.45, bobY - radius * 0.15, radius * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.globalAlpha = 0.12;
      const moonGlow = ctx.createRadialGradient(mx, bobY, radius, mx, bobY, radius * 3);
      moonGlow.addColorStop(0, '#4a90d9');
      moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(mx, bobY, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- REM = planets with ring/atmosphere ---
    const planetCount = Math.max(1, Math.round(rem / 25));
    for (let i = 0; i < planetCount; i++) {
      const px = w * 0.2 + rng() * w * 0.6;
      const py = h * 0.2 + rng() * h * 0.6;
      const radius = 14 + rng() * 22;
      const wobble = Math.sin(t * 0.2 + i * 3.7) * 3;
      const drawY = py + wobble;
      const hue = 270 + rng() * 40; // purple range

      // Planet atmosphere glow
      ctx.globalAlpha = 0.15;
      const atmoGlow = ctx.createRadialGradient(px, drawY, radius * 0.5, px, drawY, radius * 2.5);
      atmoGlow.addColorStop(0, `hsla(${hue}, 60%, 60%, 0.4)`);
      atmoGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = atmoGlow;
      ctx.beginPath();
      ctx.arc(px, drawY, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Planet body gradient
      ctx.globalAlpha = 0.9;
      const bodyGrad = ctx.createRadialGradient(
        px - radius * 0.3, drawY - radius * 0.3, radius * 0.1,
        px, drawY, radius,
      );
      bodyGrad.addColorStop(0, `hsla(${hue}, 50%, 70%, 1)`);
      bodyGrad.addColorStop(0.7, `hsla(${hue}, 60%, 45%, 1)`);
      bodyGrad.addColorStop(1, `hsla(${hue}, 70%, 25%, 1)`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(px, drawY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Ring (ellipse)
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = `hsla(${hue + 20}, 50%, 65%, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px, drawY, radius * 1.8, radius * 0.35, -0.2 + Math.sin(t * 0.1) * 0.05, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- Awake = faint red sparks ---
    const sparkCount = Math.round(awake / 5);
    for (let i = 0; i < sparkCount; i++) {
      const sx = rng() * w;
      const sy = rng() * h;
      const flicker = Math.random(); // intentionally random for chaotic flicker
      if (flicker > 0.6) {
        ctx.globalAlpha = flicker * 0.4;
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + flicker * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }, [focusDay, prevDay]);

  const canvasRef = useCanvas(draw);

  return (
    <div className="art-window">
      <span className="art-window-label">Sleep</span>
      <canvas ref={canvasRef} className="art-canvas" />
    </div>
  );
}

/* ── Heart: pulsing rings / ripples ───────────────────── */
// Concentric rings that pulse outward at the heart rate rhythm.
// Color intensity from HRV, ring spacing from resting HR.

function HeartArt({ data, focusDay }: { data: DayRecord[]; focusDay: DayRecord | null }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const hr = focusDay?.heart?.resting_hr ?? 65;
    const hrv = focusDay?.heart?.hrv_avg ?? 40;
    const bps = hr / 60; // beats per second
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#0f0508';
    ctx.fillRect(0, 0, w, h);

    const maxRadius = Math.max(w, h) * 0.7;
    const ringCount = 12;
    const beatPhase = (t * bps) % 1;
    const hrvNorm = clamp(hrv / 100, 0, 1); // higher HRV = calmer colors

    for (let i = 0; i < ringCount; i++) {
      const phase = ((i / ringCount) + beatPhase) % 1;
      const radius = phase * maxRadius;
      const alpha = (1 - phase) * 0.6;

      // Pulse distortion
      const pulse = Math.sin(t * bps * Math.PI * 2) * 0.1 + 1;
      const r = radius * pulse;

      const red = Math.round(lerp(255, 180, hrvNorm));
      const green = Math.round(lerp(60, 100, hrvNorm));
      const blue = Math.round(lerp(80, 140, hrvNorm));

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${red},${green},${blue})`;
      ctx.lineWidth = 1.5 + (1 - phase) * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center glow that pulses
    const glowPulse = 0.4 + 0.6 * Math.pow(Math.sin(t * bps * Math.PI * 2) * 0.5 + 0.5, 3);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    grad.addColorStop(0, `rgba(255, 80, 100, ${glowPulse * 0.5})`);
    grad.addColorStop(1, 'rgba(255, 80, 100, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 60, cy - 60, 120, 120);

    // HR text
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${hr} BPM`, cx, cy + 4);
    ctx.globalAlpha = 1;
  }, [focusDay]);

  const canvasRef = useCanvas(draw);

  return (
    <div className="art-window">
      <span className="art-window-label">Heart</span>
      <canvas ref={canvasRef} className="art-canvas" />
    </div>
  );
}

/* ── Activity: flowing energy particles ───────────────── */
// Particles flow upward with velocity proportional to activity level.
// More active = more particles, faster, brighter green. Calm = slow drift.

function ActivityArt({ data, focusDay }: { data: DayRecord[]; focusDay: DayRecord | null }) {
  const particlesRef = useRef<{ x: number; y: number; vy: number; vx: number; size: number; life: number; maxLife: number }[]>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const steps = focusDay?.workout?.steps ?? 5000;
    const activeMins = focusDay?.workout?.active_min ?? 20;
    const intensity = clamp(steps / 15000, 0.1, 1);
    const density = Math.floor(lerp(1, 5, intensity));

    ctx.fillStyle = 'rgba(5, 15, 10, 0.15)';
    ctx.fillRect(0, 0, w, h);

    const particles = particlesRef.current;

    // Spawn new particles
    for (let i = 0; i < density; i++) {
      if (particles.length < 300) {
        const maxLife = 120 + Math.random() * 180;
        particles.push({
          x: Math.random() * w,
          y: h + 10,
          vy: -(0.5 + Math.random() * 2 * intensity),
          vx: (Math.random() - 0.5) * 0.8,
          size: 1 + Math.random() * 2.5 * intensity,
          life: 0,
          maxLife,
        });
      }
    }

    // Draw wave lines at bottom
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#55efc4';
    ctx.lineWidth = 1;
    for (let l = 0; l < 3; l++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h - 20 - l * 15 + Math.sin(x * 0.02 + t * 0.8 + l) * 8;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      p.x += p.vx + Math.sin(t * 2 + p.y * 0.01) * 0.3;
      p.y += p.vy;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;

      if (p.life > p.maxLife || p.y < -20) {
        particles.splice(i, 1);
        continue;
      }

      const green = Math.round(lerp(180, 239, intensity));
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = `rgb(85, ${green}, 196)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      ctx.globalAlpha = alpha * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Activity hint
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#55efc4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${(steps / 1000).toFixed(1)}k steps  ${activeMins}m active`, w / 2, h - 8);
    ctx.globalAlpha = 1;
  }, [focusDay]);

  const canvasRef = useCanvas(draw);

  return (
    <div className="art-window">
      <span className="art-window-label">Activity</span>
      <canvas ref={canvasRef} className="art-canvas" />
    </div>
  );
}

/* ── Stress: organic flow field ───────────────────────── */
// Smooth flowing lines — calm/recovered = smooth parallel curves in cool blue,
// stressed = turbulent crossing lines in warm amber/red.

function StressArt({ data, focusDay }: { data: DayRecord[]; focusDay: DayRecord | null }) {
  const linesRef = useRef<{ points: { x: number; y: number }[]; hue: number; speed: number }[]>([]);
  const keyRef = useRef('');

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    if (w < 1 || h < 1) return;

    const stressHigh = focusDay?.stress?.stress_high ?? 60;
    const recoveryHigh = focusDay?.stress?.recovery_high ?? 120;
    const total = stressHigh + recoveryHigh || 1;
    const stressRatio = stressHigh / total; // 0 = fully recovered, 1 = fully stressed
    const turbulence = lerp(0.3, 2.5, stressRatio);

    const key = `${focusDay?.date ?? 'none'}-${w}-${h}`;
    if (key !== keyRef.current) {
      keyRef.current = key;
      const lines: typeof linesRef.current = [];
      const count = 25;
      for (let i = 0; i < count; i++) {
        const y = (i / count) * h;
        const pts: { x: number; y: number }[] = [];
        for (let x = 0; x <= w; x += 8) {
          pts.push({ x, y: y + (Math.random() - 0.5) * 10 });
        }
        lines.push({
          points: pts,
          hue: lerp(200, 30, stressRatio) + (Math.random() - 0.5) * 30,
          speed: 0.3 + Math.random() * 0.7,
        });
      }
      linesRef.current = lines;
    }

    ctx.fillStyle = `rgba(10, 8, 15, 0.08)`;
    ctx.fillRect(0, 0, w, h);

    for (const line of linesRef.current) {
      ctx.beginPath();
      const hue = lerp(200, 30, stressRatio) + Math.sin(t * 0.3 + line.hue * 0.01) * 15;
      const sat = lerp(40, 80, stressRatio);
      const light = lerp(50, 55, stressRatio);
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.35)`;
      ctx.lineWidth = 1.2;

      for (let i = 0; i < line.points.length; i++) {
        const p = line.points[i];
        // Flow field: noise-like displacement
        const noiseX = Math.sin(p.x * 0.008 + t * line.speed * 0.5) * turbulence;
        const noiseY = Math.cos(p.y * 0.01 + t * line.speed * 0.3 + p.x * 0.005) * turbulence * 8;
        const drawX = p.x + noiseX * 5;
        const drawY = p.y + noiseY;

        if (i === 0) ctx.moveTo(drawX, drawY);
        else ctx.lineTo(drawX, drawY);
      }
      ctx.stroke();
    }

    // Summary label
    const summary = focusDay?.stress?.day_summary ?? 'normal';
    const labelColor = stressRatio > 0.5
      ? `hsla(30, 70%, 60%, 0.3)`
      : `hsla(200, 50%, 60%, 0.3)`;
    ctx.globalAlpha = 1;
    ctx.fillStyle = labelColor;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(summary, w / 2, h - 8);
  }, [focusDay]);

  const canvasRef = useCanvas(draw);

  return (
    <div className="art-window">
      <span className="art-window-label">Stress</span>
      <canvas ref={canvasRef} className="art-canvas" />
    </div>
  );
}
