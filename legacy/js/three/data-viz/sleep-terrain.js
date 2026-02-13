import { THREE } from '../scene-manager.js';

export class SleepTerrain {
  constructor() {
    this.mesh = null;
    this.data = [];
  }

  init(scene, camera) {
    // Lighting
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

  update(data) {
    this.data = data || [];
    if (this.mesh && this.mesh.parent) {
      const scene = this.mesh.parent;
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this._buildTerrain(scene, this.data);
    }
  }

  _buildTerrain(scene, data) {
    const days = Math.max(data.length, 1);
    const cols = Math.min(days, 31);
    const rows = 5; // metrics: duration, efficiency, deep, rem, readiness

    const width = 20;
    const depth = 10;
    const geometry = new THREE.PlaneGeometry(width, depth, cols - 1 || 1, rows - 1);
    geometry.rotateX(-Math.PI * 0.5);

    const positions = geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = (row * cols + col) * 3;
        let height = 0;
        let r = 0.3, g = 0.5, b = 0.9;

        if (col < data.length) {
          const sleep = data[col].sleep || {};
          switch (row) {
            case 0: height = (sleep.duration_hours || 0) / 10 * 4; break;
            case 1: height = (sleep.efficiency || 0) / 100 * 4; break;
            case 2: height = (sleep.deep_min || 0) / 120 * 4; break;
            case 3: height = (sleep.rem_min || 0) / 140 * 4; break;
            case 4: height = (sleep.readiness_score || 0) / 100 * 4; break;
          }
          // Color by height
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

    // Add wireframe overlay
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

  animate(delta, elapsed) {
    if (this.mesh) {
      this.mesh.rotation.y = Math.sin(elapsed * 0.15) * 0.3;
      if (this._wireframe) {
        this._wireframe.rotation.y = this.mesh.rotation.y;
      }
    }
  }

  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    if (this._wireframe) {
      scene.remove(this._wireframe);
      this._wireframe.geometry.dispose();
      this._wireframe.material.dispose();
      this._wireframe = null;
    }
    if (this._ambient) { scene.remove(this._ambient); this._ambient = null; }
    if (this._dirLight) { scene.remove(this._dirLight); this._dirLight = null; }
  }
}
