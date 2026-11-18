const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $('hud');
    this.menu = $('menu');
    this.gameover = $('gameover');
    this.pause = $('pause');
    this.scoreEl = $('score');
    this.distEl = $('distance');
    this.crystalEl = $('crystals');
    this.speedEl = $('speed-box');
    this.comboEl = $('combo');
    this.comboCountEl = $('combo-count');
    this.comboMultEl = $('combo-mult');
    this.best = Number(localStorage.getItem('neon-rush-best') || 0);
    $('menu-best').textContent = this.best;
  }

  setBest(v) {
    this.best = v;
    localStorage.setItem('neon-rush-best', String(v));
    $('menu-best').textContent = v;
  }

  showMenu() {
    this.menu.classList.remove('hidden');
    this.gameover.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showGame() {
    this.menu.classList.add('hidden');
    this.gameover.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showGameover(stats) {
    $('final-score').textContent = Math.floor(stats.score);
    $('final-distance').textContent = Math.floor(stats.distance) + ' m';
    $('final-crystals').textContent = stats.crystals;
    $('final-combo').textContent = stats.maxCombo || 0;
    $('final-best').textContent = this.best;
    $('new-record').classList.toggle('hidden', !stats.newRecord);
    this.gameover.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.comboEl.classList.add('hidden');
  }

  showPause() { this.pause.classList.remove('hidden'); }
  hidePause() { this.pause.classList.add('hidden'); }

  updateHUD(score, distance, crystals, speedMul) {
    this.scoreEl.textContent = Math.floor(score);
    this.distEl.textContent = Math.floor(distance) + ' m';
    this.crystalEl.textContent = crystals;
    this.speedEl.textContent = 'x' + speedMul.toFixed(1);
  }

  // 连击显示：连击 >= 2 时出现，倍率随连击提升
  setCombo(combo, mult) {
    if (combo >= 2) {
      this.comboEl.classList.remove('hidden');
      this.comboCountEl.textContent = combo;
      this.comboMultEl.textContent = 'x' + mult.toFixed(1);
      // 触发弹跳动画（重置以可重复播放）
      this.comboEl.classList.remove('pop');
      void this.comboEl.offsetWidth;
      this.comboEl.classList.add('pop');
    } else {
      this.comboEl.classList.add('hidden');
    }
  }
}
