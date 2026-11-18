// 极简 WebAudio 音效：无需任何素材文件
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _tone(freq, dur, type = 'square', vol = 0.15, slide = 0) {
    const ctx = this._ensure();
    if (!ctx || this.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  jump() { this._tone(320, 0.18, 'square', 0.12, 220); }
  collect() { this._tone(880, 0.12, 'triangle', 0.14, 400); }
  land() { this._tone(140, 0.08, 'sine', 0.1, -60); }
  crash() {
    this._tone(200, 0.4, 'sawtooth', 0.18, -160);
    this._tone(90, 0.5, 'square', 0.14, -50);
  }
  start() { this._tone(440, 0.15, 'triangle', 0.12, 220); }
}
