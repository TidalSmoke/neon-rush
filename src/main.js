import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Obstacles } from './obstacles.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';

// ---------- 基础渲染 ----------
const container = document.getElementById('game-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 模块 ----------
const world = new World(scene);
const player = new Player(scene);
const obstacles = new Obstacles(scene);
const effects = new Effects(scene);
const ui = new UI();
const sfx = new Sfx();

// ---------- 游戏状态 ----------
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3 };
let state = STATE.MENU;

const BASE_SPEED = 13;
const MAX_SPEED = 30;
let speed = BASE_SPEED;
let score = 0;
let distance = 0;
let crystals = 0;
let deathTimer = 0;
let deathAt = 0;      // 死亡时的真实时间戳，用于低帧率下仍按时弹面板
let panelShown = false;
let combo = 0;        // 连续无碰撞收集数
let comboTimer = 0;   // 连击窗口剩余时间
let maxCombo = 0;

function startGame() {
  speed = BASE_SPEED;
  score = 0;
  distance = 0;
  crystals = 0;
  deathTimer = 0;
  deathAt = 0;
  panelShown = false;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  camera.fov = 62;
  camera.updateProjectionMatrix();
  player.reset();
  obstacles.reset();
  world.reset();
  effects.reset();
  state = STATE.PLAYING;
  ui.showGame();
  ui.setCombo(0, 1);
  sfx.start();
}

function gameOver() {
  if (state !== STATE.PLAYING) return;
  state = STATE.GAMEOVER;
  player.die();
  sfx.crash();
  effects.shake(1.4);
  effects.burst(player.x, player.y + 0.8, 0, 0x00f0ff, 40, 9, 8);
  effects.burst(player.x, player.y + 0.8, 0, 0xff2d95, 40, 9, 8);
  combo = 0;
  comboTimer = 0;
  ui.setCombo(0, 1);
  deathTimer = 0;
  deathAt = performance.now();
}

function showGameoverPanel() {
  if (panelShown) return;
  panelShown = true;
  const newRecord = score > ui.best;
  if (newRecord) ui.setBest(Math.floor(score));
  ui.showGameover({ score, distance, crystals, newRecord, maxCombo });
}

// ---------- 输入 ----------
function tryMoveLane(dir) {
  if (state !== STATE.PLAYING) return;
  player.moveLane(dir);
}
function tryJump() {
  if (state !== STATE.PLAYING) return;
  player.queueJump();
}
function tryFastFall() {
  if (state !== STATE.PLAYING) return;
  player.fastFall = true;
}
function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    ui.showPause();
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    ui.hidePause();
  }
}

window.addEventListener('keydown', e => {
  switch (e.code) {
    case 'ArrowLeft': case 'KeyA': tryMoveLane(-1); break;
    case 'ArrowRight': case 'KeyD': tryMoveLane(1); break;
    case 'ArrowUp': case 'KeyW': case 'Space':
      e.preventDefault();
      tryJump();
      break;
    case 'ArrowDown': case 'KeyS': tryFastFall(); break;
    case 'KeyP': case 'Escape': togglePause(); break;
    case 'KeyM': toggleMute(); break;
    case 'Enter':
      if (state === STATE.MENU || state === STATE.GAMEOVER) startGame();
      break;
  }
});

// 触屏手势：左右滑换道 / 上滑跳 / 下滑速降 / 点按跳
let touchStart = null;
window.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
window.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
    tryMoveLane(dx > 0 ? 1 : -1);
  } else if (dy < -30) {
    tryJump();
  } else if (dy > 30) {
    tryFastFall();
  } else if (state === STATE.PLAYING) {
    tryJump();
  }
}, { passive: true });

// 按钮
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', () => {
  state = STATE.MENU;
  ui.showMenu();
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', () => {
  ui.hidePause();
  state = STATE.MENU;
  ui.showMenu();
});

// 静音开关
const muteBtn = document.getElementById('mute-btn');
function toggleMute() {
  sfx.muted = !sfx.muted;
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
}
muteBtn.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });

// 切到后台时自动暂停，避免回来已经撞死
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === STATE.PLAYING) togglePause();
});
window.addEventListener('blur', () => {
  if (state === STATE.PLAYING) togglePause();
});

// ---------- 相机 ----------
function updateCamera(dt, time) {
  const shake = effects.getShakeOffset();
  // 轻微跟随车道，保留构图稳定感
  const targetX = player.x * 0.35;
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 6);
  camera.position.y = 5.4 + player.y * 0.35 + shake.y;
  camera.position.z = 9.6;
  camera.position.x += shake.x;
  camera.lookAt(player.x * 0.5, 1.6 + player.y * 0.3, -8);

  // 速度感：FOV 随速度缓慢张开
  if (state === STATE.PLAYING) {
    const targetFov = 62 + Math.min(1, (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 14;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2.5);
    camera.updateProjectionMatrix();
  }
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let gameTime = 0;

// 一步游戏逻辑（与渲染解耦，便于确定性测试）
function stepGame(dt) {
  gameTime += dt;
  const time = gameTime;

  if (state === STATE.GAMEOVER) {
    // 死亡定格：角色翻滚坠落，粒子飘散，稍候弹结算面板
    deathTimer += dt;
    player.updateDying(dt);
    effects.update(dt);
    updateCamera(dt, time);
    const realElapsed = (performance.now() - deathAt) / 1000;
    if (deathTimer > 0.9 || realElapsed > 1.0) showGameoverPanel();
  } else if (state === STATE.PLAYING) {
    // 难度与速度成长
    const difficulty = Math.min(1, distance / 1600);
    speed = Math.min(MAX_SPEED, BASE_SPEED + distance * 0.012);

    const res = player.update(dt, speed, time);
    if (res.landed) {
      sfx.land();
      effects.shake(0.15);
      effects.burst(player.x, 0.1, 0.4, 0xa24dff, 6, 2.5, 1.5);
    }

    obstacles.update(
      dt, speed, difficulty, player,
      () => gameOver(),
      (x, y, z) => {
        // 连击：3 秒窗口内连续收集，倍率随连击增长
        crystals++;
        combo++;
        comboTimer = 3;
        maxCombo = Math.max(maxCombo, combo);
        const mult = 1 + Math.min(4, Math.floor(combo / 2)) * 0.5;
        score += Math.round(50 * mult);
        sfx.collect();
        const color = mult > 2 ? 0xffd84d : mult > 1.5 ? 0xff2d95 : 0x00f0ff;
        effects.burst(x, y, z, color, 12 + Math.min(20, combo), 4, 3);
        effects.shake(0.06);
        ui.setCombo(combo, mult);
      }
    );

    // 连击窗口衰减
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        ui.setCombo(0, 1);
      }
    }

    distance += speed * dt;
    score += speed * dt * 10;
    ui.updateHUD(score, distance, crystals, speed / BASE_SPEED);

    world.update(dt, speed, time);
    effects.update(dt);
    updateCamera(dt, time);
  } else if (state === STATE.MENU) {
    // 菜单：空赛道缓慢巡游
    world.update(dt, 4, time);
    effects.update(dt);
    updateCamera(dt, time);
    player.update(dt, 4, time);
  } else {
    // 暂停：仅更新相机/粒子
    effects.update(dt);
    updateCamera(dt, time);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  stepGame(dt);
  renderer.render(scene, camera);
}

animate();

// 调试 / 自动化测试钩子（不影响正常玩法）
window.__neon = {
  step: dt => stepGame(dt),
  start: () => startGame(),
  keys: { left: () => tryMoveLane(-1), right: () => tryMoveLane(1), jump: () => tryJump(), down: () => tryFastFall() },
  state: () => ({ state, score, distance, crystals, speed, playerX: player.x, playerY: player.y, grounded: player.grounded, dead: player.dead, best: ui.best, combo, maxCombo, muted: sfx.muted, fov: camera.fov,
    nearCrystals: obstacles.crystals.filter(c => c.oz > -30 && c.oz < 5).map(c => ({ x: c.ox, y: c.oy, z: c.oz })),
    nearObstacles: obstacles.obstacles.filter(o => o.oz > -30 && o.oz < 5).map(o => ({ x: o.ox, y: o.oy, z: o.oz, hx: o.hx, hy: o.hy, hz: o.hz })),
    pits: obstacles.pits.filter(p => p.oz > -30 && p.oz < 5).map(p => p.oz) })
};
