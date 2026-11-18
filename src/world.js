import * as THREE from 'three';

export const SEG_LEN = 24;
export const SEG_COUNT = 12;
export const TRACK_W = 9.2;
export const LANES = [-2.8, 0, 2.8];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.speed = 0;

    this._setupBackground();
    this._setupLights();
    this._setupTrack();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0x9a6bff, 0x2a0a4a, 1.1);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0x88ccff, 1.2);
    dir.position.set(6, 12, 5);
    this.scene.add(dir);

    const pink = new THREE.PointLight(0xff2d95, 1.4, 60);
    pink.position.set(0, 6, 4);
    this.scene.add(pink);
  }

  _setupBackground() {
    // 深紫夜空
    this.scene.background = new THREE.Color(0x0d0221);
    this.scene.fog = new THREE.Fog(0x12041f, 45, 190);

    // 合成波太阳（多环剪影）
    const sunGroup = new THREE.Group();
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(42, 48),
      new THREE.MeshBasicMaterial({ color: 0xff2d95, fog: false })
    );
    sunGroup.add(sun);
    // 太阳上的横向割线
    for (let i = 0; i < 6; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 1.5 + i * 1.6),
        new THREE.MeshBasicMaterial({ color: 0x12041f, fog: false })
      );
      strip.position.y = -8 - i * 5.5;
      strip.position.z = 0.1;
      sunGroup.add(strip);
    }
    // 光晕
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      new THREE.MeshBasicMaterial({ color: 0xa24dff, transparent: true, opacity: 0.35, fog: false })
    );
    halo.position.z = -0.5;
    sunGroup.add(halo);

    sunGroup.position.set(0, 34, -330);
    this.scene.add(sunGroup);
    this.sun = sunGroup;

    // 星星
    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 260 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = 40 + r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 40;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xbfe8ff, size: 1.6, fog: false, transparent: true, opacity: 0.9
    }));
    this.scene.add(stars);
    this.stars = stars;

    // 远山剪影（两层低多边形山）
    this.mountains = [];
    const makeRange = (count, dist, minH, maxH, color) => {
      for (let i = 0; i < count; i++) {
        const h = minH + Math.random() * (maxH - minH);
        const w = h * (1.4 + Math.random() * 1.4);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(w / 2, h, 4 + Math.floor(Math.random() * 3)),
          new THREE.MeshBasicMaterial({ color, fog: false })
        );
        const side = Math.random() < 0.5 ? -1 : 1;
        m.position.set(side * (28 + Math.random() * 70), h / 2 - 8, -dist - Math.random() * 220);
        m.rotation.y = Math.random() * Math.PI;
        this.scene.add(m);
        this.mountains.push(m);
      }
    };
    makeRange(10, 120, 30, 70, 0x3c1268);
    makeRange(8, 90, 18, 42, 0x2a0b4e);

    // 网格地板（赛道路面之下的深渊）
    this.grid = new THREE.GridHelper(700, 70, 0xff2d95, 0x4b1a6e);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.grid.position.y = -7;
    this.scene.add(this.grid);

    const abyss = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshBasicMaterial({ color: 0x08010f })
    );
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.y = -7.2;
    this.scene.add(abyss);
  }

  _makeSegment() {
    const g = new THREE.Group();

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_W, 1, SEG_LEN),
      new THREE.MeshStandardMaterial({ color: 0x1b0b33, flatShading: true, roughness: 0.9 })
    );
    deck.position.y = -0.5;
    g.add(deck);

    // 两侧霓虹灯带（每段交替粉/青）
    const cA = new THREE.Color(Math.random() < 0.5 ? 0xff2d95 : 0x00f0ff);
    const cB = new THREE.Color(Math.random() < 0.5 ? 0xa24dff : 0x00f0ff);
    g.userData.rails = [];
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.18, SEG_LEN),
        new THREE.MeshStandardMaterial({
          color: 0x111111, emissive: side < 0 ? cA : cB,
          emissiveIntensity: 2.2, roughness: 0.4
        })
      );
      rail.position.set(side * (TRACK_W / 2 + 0.1), 0.02, 0);
      g.add(rail);
      g.userData.rails.push(rail);
    }

    // 路面横向亮纹（速度感知）
    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_W - 0.6, 0.02, 0.5),
        new THREE.MeshStandardMaterial({
          color: 0x221040, emissive: 0x5a2e9e, emissiveIntensity: 0.7
        })
      );
      stripe.position.set(0, 0.011, -SEG_LEN / 2 + (i + 0.5) * (SEG_LEN / stripeCount));
      g.add(stripe);
    }

    return g;
  }

  _setupTrack() {
    this.segments = [];
    const frontZ = 14;
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = this._makeSegment();
      seg.position.z = frontZ - SEG_LEN / 2 - i * SEG_LEN;
      this.scene.add(seg);
      this.segments.push(seg);
    }
  }

  update(dt, speed, time) {
    this.speed = speed;

    // 赛道分段回收
    const glow = 2.0 + Math.min(1, Math.max(0, (speed - 13) / 17)) * 2.2;
    for (const seg of this.segments) {
      seg.position.z += speed * dt;
      if (seg.position.z - SEG_LEN / 2 > 16) {
        seg.position.z -= SEG_COUNT * SEG_LEN;
      }
      if (seg.userData.rails) {
        for (const rail of seg.userData.rails) {
          rail.material.emissiveIntensity = glow;
        }
      }
    }

    // 背景轻微动态
    this.sun.rotation.z = 0;
    this.stars.rotation.y = Math.sin(time * 0.02) * 0.02;
    this.grid.material.opacity = 0.45 + Math.sin(time * 2) * 0.08;
  }

  reset() {
    const frontZ = 14;
    this.segments.forEach((seg, i) => {
      seg.position.z = frontZ - SEG_LEN / 2 - i * SEG_LEN;
    });
  }
}
