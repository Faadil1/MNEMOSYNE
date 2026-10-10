// MNEMOSYNE — generative soundscape (all synthesized, no assets)
export class GardenAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  muted = false;
  private scale = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic
  private base = 220;
  private lastTend = -Infinity;
  private lastWind = -Infinity;

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = typeof AudioContext !== 'undefined' ? AudioContext : audioWindow.webkitAudioContext;
    if (!AudioCtor) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioCtor();
      this.ctx = ctx;
    } catch { return; }
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // wind: looped noise through a slowly wandering bandpass
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 320;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      const param = this.master.gain;
      param.cancelScheduledValues(this.ctx.currentTime);
      param.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.12);
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setWind(strength: number, gust: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    if (t - this.lastWind < 0.12) return;
    this.lastWind = t;
    this.windGain.gain.cancelScheduledValues(t);
    this.windFilter.frequency.cancelScheduledValues(t);
    this.windGain.gain.setTargetAtTime(0.035 + Math.abs(strength) * 0.05 + gust * 0.12, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(280 + Math.abs(strength) * 260 + gust * 320, t, 0.3);
  }

  private plink(freq: number, vol: number, dur = 1.6) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.1);
  }

  detach() {
    if (!this.ctx || this.muted) return;
    const deg = this.scale[Math.floor(Math.random() * this.scale.length)];
    this.plink(this.base * Math.pow(2, deg / 12) * 2, 0.05, 2.2);
  }

  tend() {
    if (!this.ctx || this.muted || this.ctx.currentTime - this.lastTend < 0.9) return;
    this.lastTend = this.ctx.currentTime;
    const deg = this.scale[Math.floor(Math.random() * 4)];
    this.plink(this.base * Math.pow(2, deg / 12), 0.03, 1.2);
  }

  bloom() {
    if (!this.ctx || this.muted) return;
    [0, 3, 7].forEach((d, i) =>
      setTimeout(() => this.plink(this.base * Math.pow(2, d / 12), 0.06, 2.8), i * 120));
  }

  release() {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    // rising shimmer
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        const deg = this.scale[i % this.scale.length] + 12;
        this.plink(this.base * Math.pow(2, deg / 12) * (1 + i * 0.06), 0.05, 2.4);
      }, i * 90);
    }
    // whoosh
    const len = ctx.sampleRate * 1.4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 1.1);
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }
}
