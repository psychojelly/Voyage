import { THREE } from '../scene-manager';
import type { SceneEffect } from '../scene-manager';
import type { DayRecord } from '@/lib/types';

interface SphereData {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  phaseOffset: number;
  yAmp: number;
}

export class MetricSpheres implements SceneEffect {
  spheres: SphereData[];
  group: THREE.Group | null;
  private _centerMesh: THREE.Mesh | null;
  private _ambient: THREE.AmbientLight | null;
  private _pointLight: THREE.PointLight | null;

  constructor() {
    this.spheres = [];
    this.group = null;
    this._centerMesh = null;
    this._ambient = null;
    this._pointLight = null;
  }

  init(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    this._ambient = ambient;

    const pointLight = new THREE.PointLight(0x55efc4, 1.5, 40);
    pointLight.position.set(0, 8, 5);
    scene.add(pointLight);
    this._pointLight = pointLight;

    this.group = new THREE.Group();
    scene.add(this.group);

    if (camera) {
      camera.position.set(0, 6, 22);
      camera.lookAt(0, 0, 0);
    }
  }

  update(data: unknown[]) {
    if (!this.group) return;
    while (this.group.children.length > 0) {
      const child = this.group.children[0] as THREE.Mesh;
      this.group.remove(child);
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    this.spheres = [];

    const records = data as DayRecord[];
    if (!records || !records.length) return;

    const workouts = records.map(d => d.workout).filter(Boolean);
    const hearts = records.map(d => d.heart).filter(Boolean);

    if (!workouts.length && !hearts.length) return;

    const avgSteps = workouts.length ? workouts.reduce((s, w) => s + (w!.steps || 0), 0) / workouts.length : 0;
    const avgCals = workouts.length ? workouts.reduce((s, w) => s + (w!.calories_active || 0), 0) / workouts.length : 0;
    const avgActive = workouts.length ? workouts.reduce((s, w) => s + (w!.active_min || 0), 0) / workouts.length : 0;
    const avgHr = hearts.length ? hearts.reduce((s, h) => s + (h!.resting_hr || 0), 0) / hearts.length : 0;
    const avgHrv = hearts.length ? hearts.reduce((s, h) => s + (h!.hrv_avg || 0), 0) / hearts.length : 0;

    const metrics = [
      { label: 'Steps', value: avgSteps, max: 15000, color: 0x55efc4, orbitRadius: 7, orbitSpeed: 0.3 },
      { label: 'Calories', value: avgCals, max: 800, color: 0x00cec9, orbitRadius: 5, orbitSpeed: 0.5 },
      { label: 'Active', value: avgActive, max: 120, color: 0x81ecec, orbitRadius: 3.5, orbitSpeed: 0.7 },
      { label: 'HR', value: avgHr, max: 100, color: 0xff6b6b, orbitRadius: 9, orbitSpeed: 0.2 },
      { label: 'HRV', value: avgHrv, max: 80, color: 0xfd79a8, orbitRadius: 6, orbitSpeed: 0.4 },
    ];

    metrics.forEach((m, i) => {
      const t = Math.min(m.value / m.max, 1);
      const radius = 0.3 + t * 1.2;

      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: m.color,
        emissive: m.color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
        shininess: 60,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const angle = (i / metrics.length) * Math.PI * 2;
      mesh.position.x = Math.cos(angle) * m.orbitRadius;
      mesh.position.z = Math.sin(angle) * m.orbitRadius;
      mesh.position.y = Math.sin(angle * 2) * 1.5;

      this.group!.add(mesh);
      this.spheres.push({
        mesh,
        orbitRadius: m.orbitRadius,
        orbitSpeed: m.orbitSpeed,
        phaseOffset: angle,
        yAmp: 1 + t,
      });
    });

    const avgScore = workouts.length ? workouts.reduce((s, w) => s + (w!.activity_score || 0), 0) / workouts.length : 0;
    const centerSize = 0.5 + (avgScore / 100) * 1.5;
    const centerGeo = new THREE.SphereGeometry(centerSize, 32, 32);
    const centerMat = new THREE.MeshPhongMaterial({
      color: 0xa29bfe,
      emissive: 0x6c5ce7,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.7,
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    this.group.add(centerMesh);
    this._centerMesh = centerMesh;
  }

  animate(delta: number, elapsed: number) {
    if (!this.group) return;

    for (const s of this.spheres) {
      const angle = elapsed * s.orbitSpeed + s.phaseOffset;
      s.mesh.position.x = Math.cos(angle) * s.orbitRadius;
      s.mesh.position.z = Math.sin(angle) * s.orbitRadius;
      s.mesh.position.y = Math.sin(angle * 1.5) * s.yAmp;
    }

    if (this._centerMesh) {
      this._centerMesh.rotation.y += delta * 0.5;
      this._centerMesh.position.y = Math.sin(elapsed * 0.8) * 0.5;
    }
  }

  dispose(scene: THREE.Scene) {
    if (this.group) {
      while (this.group.children.length > 0) {
        const child = this.group.children[0] as THREE.Mesh;
        this.group.remove(child);
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      scene.remove(this.group);
      this.group = null;
    }
    this.spheres = [];
    this._centerMesh = null;
    if (this._ambient) { scene.remove(this._ambient); this._ambient = null; }
    if (this._pointLight) { scene.remove(this._pointLight); this._pointLight = null; }
  }
}
