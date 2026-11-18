import * as THREE from 'three';
import { LANES, TRACK_W } from './world.js';

const SPAWN_Z = -170;
const DESPAWN_Z = 14;

const mat = (c, ei = 0) => new THREE.MeshStandardMaterial({
  color: c, flatShading: true, roughness: 0.6,
  emissive: c, emissiveIntensity: ei
});

function makeBlockMesh(w, h, d, color = 0xff2d95) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 0.9));
  // 顶部高亮描边
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1),
    new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: 0x00f0ff, emissiveIntensity: 2.5
    })
  );
  edge.position.y = h / 2 + 0.02;
  m.add(edge);
  return m;
}

function makeCrystalMesh() {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 2.2, flatShading: true
    })
  );
  return m;
}

function makePitMesh(len) {
  const g = new THREE.Group();
  // 深渊缺口视觉
  const void_ = new THREE.Mesh(
    new THREE.BoxGeometry(TRACK_W, 1.2, len),
    new THREE.MeshBasicMaterial({ color: 0x08010f })
  );
  void_.position.y = -0.61;
  g.add(void_);
  // 两缘红霓虹警示条
  for (const side of [-1, 1]) {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_W, 0.08, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2d95, emissiveIntensity: 3 })
    );
    lip.position.set(0, 0.02, side * (len / 2 - 0.15));
    g.add(lip);
  }
  return g;
}

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];   // {mesh, type, ox, oy, oz, hx, hy, hz, moveAmp, moveFreq, phase}
    this.crystals = [];    // {mesh, oz, oy, ox, collected}
    this.pits = [];        // {mesh, oz, halfLen}
    this.distSinceSpawn = 0;
    this.nextGap = 20;
    this.time = 0;
  }

  reset() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.crystals) this.scene.remove(c.mesh);
    for (const p of this.pits) this.scene.remove(p.mesh);
    this.obstacles.length = 0;
    this.crystals.length = 0;
    this.pits.length = 0;
    this.distSinceSpawn = 0;
    this.nextGap = 24;
    this.time = 0;
  }

  _addBlock(lane, z, w, h, d, color, moveAmp = 0, moveFreq = 0) {
    const mesh = makeBlockMesh(w, h, d, color);
    const oy = h / 2;
    mesh.position.set(LANES[lane], oy, z);
    this.scene.add(mesh);
    this.obstacles.push({
      mesh, type: 'block',
      ox: LANES[lane], oy, oz: z,
      hx: w / 2, hy: h / 2, hz: d / 2,
      moveAmp, moveFreq, phase: Math.random() * Math.PI * 2
    });
  }

  _addPit(z, len) {
    const mesh = makePitMesh(len);
    mesh.position.set(0, 0, z);
    this.scene.add(mesh);
    this.pits.push({ mesh, oz: z, halfLen: len / 2 });
  }

  _addCrystal(x, y, z) {
    const mesh = makeCrystalMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.crystals.push({ mesh, ox: x, oy: y, oz: z, collected: false });
  }

  _crystalLine(lane, z, n, step = 2.2) {
    for (let i = 0; i < n; i++) this._addCrystal(LANES[lane], 1.1, z - i * step);
  }

  _crystalArc(lane, z, n = 5) {
    // 跳跃弧线上的水晶
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = 1.1 + Math.sin(t * Math.PI) * 1.5;
      this._addCrystal(LANES[lane], y, z - i * 2.0);
    }
  }

  // 返回本 pattern 占用的纵深
  _spawnPattern(difficulty, z) {
    const r = Math.random();
    if (r < 0.18) {
      // 依次排开的单车道方块阵（随难度车道数增多）
      const n = 2 + Math.floor(difficulty * 2);
      const used = new Set();
      for (let i = 0; i < n; i++) {
        let lane;
        do { lane = Math.floor(Math.random() * 3); } while (used.has(lane));
        used.add(lane);
        this._addBlock(lane, z - i * 9, 2.2, 2.4, 2.2, 0xff2d95);
      }
      // 安全车道上放引导水晶
      const free = [0, 1, 2].filter(l => !used.has(l));
      if (free.length) this._crystalLine(free[Math.floor(Math.random() * free.length)], z, n + 1, 9);
      return n * 9 + 4;
    } else if (r < 0.36) {
      // 宽矮墙 → 必须跳
      this._addBlock(1, z, TRACK_W - 0.6, 0.85, 1.6, 0xa24dff);
      this.obstacles[this.obstacles.length - 1].ox = 0;
      this.obstacles[this.obstacles.length - 1].mesh.position.x = 0;
      this.obstacles[this.obstacles.length - 1].hx = (TRACK_W - 0.6) / 2;
      this._crystalArc(1, z + 2.5);
      return 8;
    } else if (r < 0.52) {
      // 深渊缺口 → 必须跳
      const len = 4 + difficulty * 2;
      this._addPit(z, len);
      this._crystalArc(Math.floor(Math.random() * 3), z + 1, 4);
      return len + 6;
    } else if (r < 0.68) {
      // 双车道高墙 → 换道躲
      const lane = Math.floor(Math.random() * 3);
      for (const l of [0, 1, 2]) {
        if (l !== lane) this._addBlock(l, z, 2.2, 2.4, 2.2, 0xff2d95);
      }
      this._crystalLine(lane, z, 3, 3);
      return 10;
    } else if (r < 0.84 && difficulty > 0.15) {
      // 横向巡逻方块 → 掐时机换道
      const w = 2.2, h = 1.1, d = 2.2;
      const mesh = makeBlockMesh(w, h, d, 0x00f0ff);
      const oy = h / 2;
      mesh.position.set(0, oy, z);
      this.scene.add(mesh);
      this.obstacles.push({
        mesh, type: 'block',
        ox: 0, oy, oz: z,
        hx: w / 2, hy: h / 2, hz: d / 2,
        moveAmp: 2.8, moveFreq: 1.6 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2
      });
      return 10;
    } else {
      // 纯水晶奖励线
      const lane = Math.floor(Math.random() * 3);
      this._crystalLine(lane, z, 6);
      return 16;
    }
  }

  update(dt, speed, difficulty, player, onHit, onCollect, onLandCheck) {
    this.time += dt;
    const move = speed * dt;

    // 生成节奏：按已跑距离推进
    this.distSinceSpawn += move;
    if (this.distSinceSpawn >= this.nextGap) {
      this.distSinceSpawn = 0;
      const gapMin = 26 - difficulty * 12;
      this.nextGap = gapMin + Math.random() * 8;
      this._spawnPattern(difficulty, SPAWN_Z);
    }

    // 玩家 AABB
    const p = player.getAABB();

    // 障碍移动 + 碰撞
    for (const o of this.obstacles) {
      o.oz += move;
      if (o.moveAmp > 0) {
        o.ox = Math.sin(this.time * o.moveFreq + o.phase) * o.moveAmp;
      }
      o.mesh.position.set(o.ox, o.oy, o.oz);

      if (!player.dead &&
        Math.abs(p.cx - o.ox) < p.hx + o.hx &&
        Math.abs(p.cy - o.oy) < p.hy + o.hy &&
        Math.abs(p.cz - o.oz) < p.hz + o.hz) {
        onHit();
      }
    }
    // 回收
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i].oz - 3 > DESPAWN_Z) {
        this.scene.remove(this.obstacles[i].mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // 坑洞移动 + 地面检测
    let overPit = false;
    for (const pit of this.pits) {
      pit.oz += move;
      pit.mesh.position.z = pit.oz;
      if (Math.abs(pit.oz) < pit.halfLen + p.hz && player.y < 0.2) {
        overPit = true;
      }
    }
    for (let i = this.pits.length - 1; i >= 0; i--) {
      if (this.pits[i].oz - 3 > DESPAWN_Z) {
        this.scene.remove(this.pits[i].mesh);
        this.pits.splice(i, 1);
      }
    }
    player.overPit = overPit;
    if (overPit && player.grounded) player.grounded = false;

    // 坠落死亡
    if (!player.dead && player.y < -3) onHit();

    // 水晶旋转 + 收集
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.oz += move;
      c.mesh.position.set(c.ox, c.oy + Math.sin(this.time * 3 + c.oz) * 0.12, c.oz);
      c.mesh.rotation.y += dt * 3;

      if (!c.collected &&
        Math.abs(p.cx - c.ox) < 1.0 &&
        Math.abs(p.cz - c.oz) < 1.0 &&
        c.oy > p.cy - p.hy - 0.4 && c.oy < p.cy + p.hy + 0.4) {
        c.collected = true;
        onCollect(c.ox, c.oy, c.oz);
        this.scene.remove(c.mesh);
        this.crystals.splice(i, 1);
        continue;
      }
      if (c.oz > DESPAWN_Z) {
        this.scene.remove(c.mesh);
        this.crystals.splice(i, 1);
      }
    }
  }
}
