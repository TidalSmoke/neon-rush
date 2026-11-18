import * as THREE from 'three';

// 轻量粒子池：收集爆发 / 坠落爆裂 / 落地尘土
const BURST_MAX = 220;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(BURST_MAX * 3);
    this.colors = new Float32Array(BURST_MAX * 3);
    this.vel = new Float32Array(BURST_MAX * 3);
    this.life = new Float32Array(BURST_MAX);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.28, vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.shakeAmp = 0;
  }

  burst(x, y, z, colorHex, count = 18, spread = 5, up = 4) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % BURST_MAX;
      this.positions[idx * 3] = x;
      this.positions[idx * 3 + 1] = y;
      this.positions[idx * 3 + 2] = z;
      this.colors[idx * 3] = c.r;
      this.colors[idx * 3 + 1] = c.g;
      this.colors[idx * 3 + 2] = c.b;
      this.vel[idx * 3] = (Math.random() - 0.5) * spread;
      this.vel[idx * 3 + 1] = Math.random() * up + 1;
      this.vel[idx * 3 + 2] = (Math.random() - 0.5) * spread;
      this.life[idx] = 0.7 + Math.random() * 0.4;
    }
  }

  shake(amount) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  getShakeOffset() {
    if (this.shakeAmp <= 0.001) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeAmp,
      y: (Math.random() - 0.5) * this.shakeAmp
    };
  }

  update(dt) {
    for (let i = 0; i < BURST_MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9 * dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // 淡出：把颜色乘暗近似消隐
      const fade = Math.max(0, this.life[i] / 1.1);
      this.colors[i * 3] *= 1 - dt * 1.5 * fade;
      this.colors[i * 3 + 1] *= 1 - dt * 1.5 * fade;
      this.colors[i * 3 + 2] *= 1 - dt * 1.5 * fade;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    this.shakeAmp *= Math.max(0, 1 - dt * 6);
  }

  reset() {
    for (let i = 0; i < BURST_MAX; i++) {
      this.life[i] = 0;
      this.positions[i * 3 + 1] = -999;
      this.colors[i * 3] = 0;
      this.colors[i * 3 + 1] = 0;
      this.colors[i * 3 + 2] = 0;
    }
    this.shakeAmp = 0;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
