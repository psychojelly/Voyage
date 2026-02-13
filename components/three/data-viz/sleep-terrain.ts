import { THREE } from '../scene-manager';
import type { SceneEffect } from '../scene-manager';
import type { DayRecord } from '@/lib/types';

export class SleepTerrain implements SceneEffect {
  mesh: THREE.Mesh | null;
  data: DayRecord[];
  private _wireframe: THREE.Mesh | null;
  private _ambient: THREE.AmbientLight | null;
  private _dirLight: THREE.DirectionalLight | null;

  constructor() {
    this.mesh = null;
    this.data = [];
    this._wireframe = null;
    this._ambient = null;
    this._dirLight = null;
  }

  init(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);
    this._ambient = ambient;

    const dirLight = new THREE.DirectionalLight(0x74b9ff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
    this._dirLight = dirLight;

    if (camera) {
      camera.position.set(12, 10, 18);
      camera.lookAt(0, 0, 0);
    }

    this._buildTerrain(scene, []);
  }

  update(data: unknown[]) {
    this.data = (data as DayRecord[]) || [];
    if (this.mesh && this.mesh.parent) {
      const scene = this.mesh.parent as THREE.Scene;
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      if (this._wireframe) {
        scene.remove(this._wireframe);
        this._wireframe.geometry.dispose();
        (this._wireframe.material as THREE.Material).dispose();
      }
      this._buildTerrain(scene, this.data);
    }
  }

  private _buildTerrain(scene: THREE.Scene, data: DayRecord[]) {
    const days = Math.max(data.length, 1);
    const cols = Math.min(days, 31);
    const rows = 5;

    const width = 20;
    const depth = 10;
    const geometry = new THREE.PlaneGeometry(width, depth, cols - 1 || 1, rows - 1);
    geometry.rotateX(-Math.PI * 0.5);

    const positions = geometry.attributes.position.array as Float32Array;
    const colors = new Float32Array(positions.length);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = (row * cols + col) * 3;
        let height = 0;
        let r = 0.3, g = 0.5, b = 0.9;

        if (col < data.length) {
          const sleep = data[col].sleep || {} as Record<string, number>;
          switch (row) {
            case 0: height = ((sleep as DayRecord['sleep'])?.duration_hours || 0) / 10 * 4; break;
            case 1: height = ((sleep as DayRecord['sleep'])?.efficiency || 0) / 100 * 4; break;
            case 2: height = ((sleep as DayRecord['sleep'])?.deep_min || 0) / 120 * 4; break;
            case 3: height = ((sleep as DayRecord['sleep'])?.rem_min || 0) / 140 * 4; break;
            case 4: height = ((sleep as DayRecord['sleep'])?.readiness_score || 0) / 100 * 4; break;
          }
          const t = height / 4;
          r = 0.1 + (1 - t) * 0.5;
          g = 0.2 + t * 0.6;
          b = 0.6 + t * 0.4;
        }

        positions[idx + 1] = height;
        colors[idx] = r;
        colors[idx + 1] = g;
        colors[idx + 2] = b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x74b9ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this._wireframe = new THREE.Mesh(geometry.clone(), wireMat);
    this._wireframe.position.copy(this.mesh.position);
    scene.add(this._wireframe);
  }

  animate(_delta: number, elapsed: number) {
    if (this.mesh) {
      this.mesh.rotation.y = Math.sin(elapsed * 0.15) * 0.3;
      if (this._wireframe) {
        this._wireframe.rotation.y = this.mesh.rotation.y;
      }
    }
  }

  dispose(scene: THREE.Scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this._wireframe) {
      scene.remove(this._wireframe);
      this._wireframe.geometry.dispose();
      (this._wireframe.material as THREE.Material).dispose();
      this._wireframe = null;
    }
    if (this._ambient) { scene.remove(this._ambient); this._ambient = null; }
    if (this._dirLight) { scene.remove(this._dirLight); this._dirLight = null; }
  }
}
