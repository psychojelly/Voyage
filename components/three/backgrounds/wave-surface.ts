import { THREE } from '../scene-manager';
import type { SceneEffect } from '../scene-manager';
import type { DayRecord } from '@/lib/types';

export class WaveSurface implements SceneEffect {
  mesh: THREE.Mesh | null;
  amplitude: number;
  originalPositions: Float32Array | null;
  private _ambient: THREE.AmbientLight | null;
  private _pointLight: THREE.PointLight | null;

  constructor() {
    this.mesh = null;
    this.amplitude = 2;
    this.originalPositions = null;
    this._ambient = null;
    this._pointLight = null;
  }

  init(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const geometry = new THREE.PlaneGeometry(100, 60, 120, 80);
    geometry.rotateX(-Math.PI * 0.45);

    this.originalPositions = new Float32Array(geometry.attributes.position.array);

    const material = new THREE.MeshPhongMaterial({
      color: 0x6c5ce7,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = -8;
    scene.add(this.mesh);

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    this._ambient = ambient;

    const pointLight = new THREE.PointLight(0x6c5ce7, 1, 50);
    pointLight.position.set(0, 10, 10);
    scene.add(pointLight);
    this._pointLight = pointLight;

    if (camera) {
      camera.position.set(0, 12, 35);
      camera.lookAt(0, -5, 0);
    }
  }

  update(data: unknown[]) {
    const records = data as DayRecord[];
    if (!records || !records.length) return;
    const scores = records.map(d => d.sleep?.readiness_score || 0).filter(s => s > 0);
    if (scores.length) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      this.amplitude = 1 + (avg / 100) * 4;
    }
    if (this.mesh) {
      const t = this.amplitude / 5;
      const r = 0.3 + t * 0.1;
      const g = 0.2 + t * 0.5;
      const b = 0.7 + t * 0.3;
      (this.mesh.material as THREE.MeshPhongMaterial).color.setRGB(r, g, b);
    }
  }

  animate(_delta: number, elapsed: number) {
    if (!this.mesh || !this.originalPositions) return;
    const positions = (this.mesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const orig = this.originalPositions;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = orig[i3];
      const y = orig[i3 + 1];

      positions[i3 + 2] = orig[i3 + 2] +
        Math.sin(x * 0.08 + elapsed * 0.8) * this.amplitude * 0.5 +
        Math.sin(y * 0.1 + elapsed * 0.6) * this.amplitude * 0.3 +
        Math.sin((x + y) * 0.05 + elapsed * 1.2) * this.amplitude * 0.2;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;

    if (this._pointLight) {
      this._pointLight.position.x = Math.sin(elapsed * 0.5) * 20;
      this._pointLight.position.z = Math.cos(elapsed * 0.3) * 15 + 10;
    }
  }

  dispose(scene: THREE.Scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this._ambient) { scene.remove(this._ambient); this._ambient = null; }
    if (this._pointLight) { scene.remove(this._pointLight); this._pointLight = null; }
  }
}
