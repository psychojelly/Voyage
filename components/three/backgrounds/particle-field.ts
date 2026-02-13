import { THREE } from '../scene-manager';
import type { SceneEffect } from '../scene-manager';
import type { DayRecord } from '@/lib/types';

export class ParticleField implements SceneEffect {
  particleCount: number;
  particles: THREE.Points | null;
  healthScore: number;
  private _velocities: Float32Array | null;

  constructor(particleCount = 2000) {
    this.particleCount = particleCount;
    this.particles = null;
    this.healthScore = 75;
    this._velocities = null;
  }

  init(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const velocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 80;
      positions[i3 + 1] = (Math.random() - 0.5) * 60;
      positions[i3 + 2] = (Math.random() - 0.5) * 40;

      velocities[i3] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;

      sizes[i] = Math.random() * 2.5 + 0.5;

      colors[i3] = 0.4 + Math.random() * 0.2;
      colors[i3 + 1] = 0.35 + Math.random() * 0.3;
      colors[i3 + 2] = 0.8 + Math.random() * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this._velocities = velocities;

    const material = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  update(data: unknown[]) {
    const records = data as DayRecord[];
    if (!records || !records.length) return;
    const scores = records.map(d => d.sleep?.readiness_score || 0).filter(s => s > 0);
    if (scores.length) {
      this.healthScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    }

    if (!this.particles) return;
    const colors = (this.particles.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    const t = this.healthScore / 100;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const rand = Math.random() * 0.15;
      colors[i3] = (1 - t) * 0.8 + t * 0.2 + rand;
      colors[i3 + 1] = t * 0.7 + rand;
      colors[i3 + 2] = 0.5 + t * 0.5 + rand;
    }
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  animate(delta: number, elapsed: number) {
    if (!this.particles || !this._velocities) return;
    const positions = (this.particles.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const vel = this._velocities;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      positions[i3] += vel[i3] + Math.sin(elapsed * 0.3 + i * 0.01) * 0.005;
      positions[i3 + 1] += vel[i3 + 1] + Math.cos(elapsed * 0.2 + i * 0.02) * 0.005;
      positions[i3 + 2] += vel[i3 + 2];

      if (positions[i3] > 40) positions[i3] = -40;
      if (positions[i3] < -40) positions[i3] = 40;
      if (positions[i3 + 1] > 30) positions[i3 + 1] = -30;
      if (positions[i3 + 1] < -30) positions[i3 + 1] = 30;
      if (positions[i3 + 2] > 20) positions[i3 + 2] = -20;
      if (positions[i3 + 2] < -20) positions[i3 + 2] = 20;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.rotation.y += delta * 0.02;
  }

  dispose(scene: THREE.Scene) {
    if (this.particles) {
      scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
      this.particles = null;
    }
  }
}
