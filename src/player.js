import * as THREE from 'three';
import { LANES } from './world.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.overPit = false;
    this.dead = false;
    this.dying = false;
    this.runPhase = 0;

    this._build();
    scene.add(this.group);

    // 输入缓冲
    this.jumpQueued = false;
    this.fastFall = false;
  }

  _build() {
    const mat = (c, e = 0) => new THREE.MeshStandardMaterial({
      color: c, flatShading: true, roughness: 0.7,
      emissive: c, emissiveIntensity: e
    });
    const bodyMat = mat(0x00f0ff, 0.55);
    const headMat = mat(0xff2d95, 0.7);
    const limbMat = mat(0xa24dff, 0.4);

    // 躯干
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.34), bodyMat);
    this.body.position.y = 1.05;
    this.group.add(this.body);

    // 头
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), headMat);
    this.head.position.y = 1.66;
    this.group.add(this.head);

    // 手臂
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), limbMat);
    this.armL.geometry.translate(0, -0.25, 0);
    this.armL.position.set(-0.38, 1.35, 0);
    this.group.add(this.armL);

    this.armR = this.armL.clone();
    this.armR.position.x = 0.38;
    this.group.add(this.armR);

    // 腿
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), limbMat);
    this.legL.geometry.translate(0, -0.3, 0);
    this.legL.position.set(-0.16, 0.72, 0);
    this.group.add(this.legL);

    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legR);

    // 脚下发光悬浮板（低空滑行感）
    this.board = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.08, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: 0x00f0ff, emissiveIntensity: 2.5
      })
    );
    this.board.position.y = 0.04;
    this.group.add(this.board);
  }

  moveLane(dir) {
    if (this.dead) return;
    const next = Math.max(0, Math.min(2, this.lane + dir));
    if (next !== this.lane) this.lane = next;
  }

  queueJump() {
    if (this.dead) return;
    this.jumpQueued = true;
  }

  update(dt, speed, time) {
    // 车道插值 + 倾斜
    const targetX = LANES[this.lane];
    const dx = targetX - this.x;
    this.x += dx * Math.min(1, dt * 10);
    this.group.rotation.z = -dx * 0.25;
    this.group.rotation.y = -dx * 0.15;

    // 跳跃
    if (this.jumpQueued && this.grounded) {
      this.vy = 10.2;
      this.grounded = false;
      this.jumpQueued = false;
    }
    this.jumpQueued = false;

    // 重力（快速下坠增强）
    const g = this.fastFall && !this.grounded ? -85 : -27;
    if (!this.grounded) {
      this.vy += g * dt;
      this.y += this.vy * dt;
      const floor = this.overPit ? -Infinity : 0;
      if (this.y <= floor && floor !== -Infinity) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.fastFall = false;
        return { landed: true };
      }
    }
    this.fastFall = false;

    // 姿态
    this.group.position.set(this.x, this.y, 0);
    this.board.position.y = this.grounded ? 0.04 : 0.12;
    this.board.visible = this.grounded || this.y > -0.5;

    // 跑动摆臂/摆腿
    if (this.grounded) {
      this.runPhase += dt * (6 + speed * 0.5);
      const s = Math.sin(this.runPhase);
      const c = Math.cos(this.runPhase);
      this.legL.rotation.x = s * 0.9;
      this.legR.rotation.x = -s * 0.9;
      this.armL.rotation.x = -s * 0.7;
      this.armR.rotation.x = s * 0.7;
      this.head.position.y = 1.66 + Math.abs(c) * 0.04;
      this.body.rotation.x = 0.08;
    } else {
      // 空中姿态
      this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0.5, dt * 8);
      this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, -0.4, dt * 8);
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, -2.6, dt * 8);
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -2.6, dt * 8);
      this.body.rotation.x = -0.15;
    }
    return {};
  }

  getAABB() {
    return {
      cx: this.x, cy: this.y + 0.8, cz: 0,
      hx: 0.42, hy: 0.8, hz: 0.42
    };
  }

  die() {
    this.dead = true;
    this.dying = true;
    // 撞击时向上弹起后翻滚坠落；坠坑死亡则继续下坠
    if (this.y > -1) this.vy = 7;
  }

  // 死亡翻滚动画（在 GAMEOVER 状态下每帧调用）
  updateDying(dt) {
    if (!this.dying) return;
    if (this.y < -30) return; // 已坠出视野，停止更新
    this.vy -= 26 * dt;
    this.y += this.vy * dt;
    this.group.position.y = this.y;
    this.group.position.z += dt * 6;
    this.group.rotation.x -= dt * 9;
  }

  reset() {
    this.dead = false;
    this.dying = false;
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.overPit = false;
    this.fastFall = false;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.body.rotation.x = 0;
  }
}
