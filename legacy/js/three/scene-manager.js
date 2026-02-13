import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

export class SceneManager {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0a0f, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 30);

    this.clock = new THREE.Clock();
    this.activeEffect = null;
    this.running = false;

    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._handleResize();
  }

  setEffect(effect) {
    if (this.activeEffect) {
      this.activeEffect.dispose(this.scene);
    }
    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.activeEffect = effect;
    if (effect) {
      effect.init(this.scene, this.camera);
    }
  }

  updateData(data) {
    if (this.activeEffect && this.activeEffect.update) {
      this.activeEffect.update(data, 0);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._animate();
  }

  stop() {
    this.running = false;
  }

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();
    if (this.activeEffect && this.activeEffect.animate) {
      this.activeEffect.animate(delta, this.clock.getElapsedTime());
    }
    this.renderer.render(this.scene, this.camera);
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    if (this.activeEffect) {
      this.activeEffect.dispose(this.scene);
    }
    this.renderer.dispose();
  }
}

export class InlineSceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0f0f18, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
    this.camera.position.set(0, 5, 20);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();
    this.activeEffect = null;
    this.running = false;

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas.parentElement);
    this._handleResize();
  }

  setEffect(effect) {
    if (this.activeEffect) this.activeEffect.dispose(this.scene);
    while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
    this.activeEffect = effect;
    if (effect) effect.init(this.scene, this.camera);
  }

  updateData(data) {
    if (this.activeEffect && this.activeEffect.update) {
      this.activeEffect.update(data, 0);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._animate();
  }

  stop() { this.running = false; }

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();
    if (this.activeEffect && this.activeEffect.animate) {
      this.activeEffect.animate(delta, this.clock.getElapsedTime());
    }
    this.renderer.render(this.scene, this.camera);
  }

  _handleResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = this.canvas.clientHeight || 300;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.stop();
    this._resizeObserver.disconnect();
    if (this.activeEffect) this.activeEffect.dispose(this.scene);
    this.renderer.dispose();
  }
}

export { THREE };
