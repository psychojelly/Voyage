'use client';

import { useRef, useEffect, useState } from 'react';
import type { DayRecord } from '@/lib/types';

interface ThreeBackgroundProps {
  effect: string;
  data: DayRecord[];
  artMode?: boolean;
}

export default function ThreeBackground({ effect, data, artMode }: ThreeBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<{ setEffect: (name: string) => void; updateData: (d: DayRecord[]) => void; dispose: () => void } | null>(null);
  const effectRef = useRef(effect);
  const dataRef = useRef(data);
  const [error, setError] = useState<string | null>(null);
  effectRef.current = effect;
  dataRef.current = data;

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const [{ SceneManager }, { ParticleField }, { WaveSurface }] = await Promise.all([
          import('./scene-manager'),
          import('./backgrounds/particle-field'),
          import('./backgrounds/wave-surface'),
        ]);
        if (disposed || !canvasRef.current) return;

        const sm = new SceneManager(canvasRef.current);

        const applyEffect = (name: string) => {
          if (name === 'particles') {
            sm.setEffect(new ParticleField());
          } else if (name === 'waves') {
            sm.setEffect(new WaveSurface());
          } else {
            sm.setEffect(null);
          }
          sm.updateData(dataRef.current);
        };

        applyEffect(effectRef.current);
        sm.start();

        managerRef.current = {
          setEffect: (name: string) => applyEffect(name),
          updateData: (d: DayRecord[]) => sm.updateData(d),
          dispose: () => sm.dispose(),
        };
      } catch (err) {
        console.warn('ThreeBackground: WebGL not available', err);
        setError('WebGL unavailable — enable hardware acceleration in browser settings');
      }
    })();

    return () => {
      disposed = true;
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, []);

  // React to effect prop changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setEffect(effect);
    }
  }, [effect]);

  // React to data changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateData(data);
    }
  }, [data]);

  return (
    <>
      <canvas ref={canvasRef} className={`bg-canvas${artMode ? ' art-mode' : ''}`} />
      {error && (
        <div style={{ position: 'fixed', top: 10, left: 10, color: 'red', zIndex: 9999, fontSize: 12, background: 'rgba(0,0,0,0.8)', padding: 8, borderRadius: 4 }}>
          3D Error: {error}
        </div>
      )}
    </>
  );
}
