'use client';

import { useRef, useEffect, useState } from 'react';
import type { DayRecord } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SceneEffect {
  init(scene: any, camera: any): void;
  update?(data: any[], n: number): void;
  animate?(d: number, e: number): void;
  dispose(scene: any): void;
}

interface ThreeInlineProps {
  data: DayRecord[];
  effectFactory: () => SceneEffect;
}

export default function ThreeInline({ data, effectFactory }: ThreeInlineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<{ dispose: () => void } | null>(null);
  const dataRef = useRef(data);
  const [error, setError] = useState<string | null>(null);
  dataRef.current = data;

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const THREE = await import('three');
        if (disposed || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const testCtx = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!testCtx) throw new Error('WebGL is not available');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0f0f18, 1);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
        camera.position.set(0, 5, 20);
        camera.lookAt(0, 0, 0);

        const clock = new THREE.Clock();
        let activeEffect: ReturnType<typeof effectFactory> | null = null;

        const FIXED_HEIGHT = 300;
        const handleResize = () => {
          if (!canvas.parentElement) return;
          const w = canvas.parentElement.getBoundingClientRect().width;
          const h = FIXED_HEIGHT;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
        handleResize();

        // Create and set effect
        activeEffect = effectFactory();
        activeEffect.init(scene, camera);
        if (activeEffect.update) {
          activeEffect.update(dataRef.current, 0);
        }

        let running = true;
        const animate = () => {
          if (!running) return;
          requestAnimationFrame(animate);
          const delta = clock.getDelta();
          const elapsed = clock.getElapsedTime();
          if (activeEffect?.animate) activeEffect.animate(delta, elapsed);
          renderer.render(scene, camera);
        };
        animate();

        const mgr = {
          updateData: (d: DayRecord[]) => {
            if (activeEffect?.update) activeEffect.update(d, 0);
          },
          dispose: () => {
            running = false;
            resizeObserver.disconnect();
            if (activeEffect) activeEffect.dispose(scene);
            renderer.dispose();
          },
        };
        managerRef.current = mgr;

        // Apply current data
        mgr.updateData(dataRef.current);

      } catch (err) {
        console.warn('ThreeInline: WebGL not available', err);
        setError('WebGL unavailable');
      }
    })();

    return () => {
      disposed = true;
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (managerRef.current && 'updateData' in managerRef.current) {
      (managerRef.current as { updateData: (d: DayRecord[]) => void }).updateData(data);
    }
  }, [data]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} className="viz-3d-canvas" />
      {error && (
        <div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 11, background: 'rgba(0,0,0,0.8)', padding: 6, borderRadius: 4 }}>
          3D: {error}
        </div>
      )}
    </div>
  );
}
