/**
 * مؤثرات صوتية إجرائية (Web Audio) — بدون ملفات خارجية.
 * نغمات قصيرة، طبقات، وإحساس لعبة بطاقات حديث.
 */

export type SfxName =
  | 'ui'
  | 'select'
  | 'draw'
  | 'summon'
  | 'set'
  | 'spell'
  | 'trap'
  | 'phase'
  | 'aim'
  | 'attack'
  | 'direct'
  | 'hit'
  | 'block'
  | 'destroy'
  | 'heal'
  | 'damage'
  | 'endTurn'
  | 'win'
  | 'lose'
  | 'error'
  | 'gy';

type Tone = {
  freq: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
  slideTo?: number;
  filter?: number;
};

const STORAGE_KEY = 'aetherion.sfx.muted';

class DuelSfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  muted = false;
  volume = 0.72;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  private ensure() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this.unlocked = ctx.state === 'running';
  }

  setMuted(next: boolean) {
    this.muted = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master) {
      const ctx = this.ctx!;
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(next ? 0 : this.volume, now, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) void this.unlock().then(() => this.play('ui'));
    return this.muted;
  }

  play(name: SfxName) {
    if (this.muted) return;
    void this.unlock().then(() => this.trigger(name));
  }

  private env(
    gain: GainNode,
    t0: number,
    peak: number,
    attack: number,
    decay: number,
    sustain = 0,
  ) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || peak * 0.2), t0 + attack + decay);
  }

  private tone(opts: Tone) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.dur ?? 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
    }
    filter.type = 'lowpass';
    filter.frequency.value = opts.filter ?? 4200;
    this.env(gain, t0, opts.gain ?? 0.2, 0.01, dur * 0.85);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gainPeak: number, filterFreq: number, delay = 0, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = type === 'bandpass' ? 1.1 : 0.7;
    const gain = ctx.createGain();
    this.env(gain, t0, gainPeak, 0.005, dur * 0.9);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private chord(freqs: number[], dur: number, gain: number, type: OscillatorType = 'triangle') {
    freqs.forEach((f, i) => {
      this.tone({ freq: f, dur, gain: gain * (1 - i * 0.12), type, delay: i * 0.015 });
    });
  }

  private trigger(name: SfxName) {
    switch (name) {
      case 'ui':
        this.tone({ freq: 880, dur: 0.06, gain: 0.08, type: 'triangle' });
        break;
      case 'select':
        this.tone({ freq: 740, dur: 0.07, gain: 0.09, type: 'sine' });
        this.tone({ freq: 1180, dur: 0.05, gain: 0.05, type: 'triangle', delay: 0.03 });
        break;
      case 'draw':
        this.noise(0.09, 0.12, 1800, 0, 'highpass');
        this.tone({ freq: 520, slideTo: 920, dur: 0.14, gain: 0.12, type: 'triangle' });
        break;
      case 'summon':
        this.chord([196, 247, 311, 392], 0.28, 0.11, 'sawtooth');
        this.noise(0.16, 0.1, 900, 0.02);
        this.tone({ freq: 523, slideTo: 784, dur: 0.22, gain: 0.1, type: 'triangle', delay: 0.05 });
        break;
      case 'set':
        this.noise(0.08, 0.1, 700, 0, 'lowpass');
        this.tone({ freq: 240, slideTo: 160, dur: 0.12, gain: 0.12, type: 'triangle' });
        break;
      case 'spell':
        this.chord([523, 659, 784, 1046], 0.32, 0.09, 'sine');
        this.noise(0.2, 0.08, 2400, 0.04, 'bandpass');
        break;
      case 'trap':
        this.tone({ freq: 180, slideTo: 90, dur: 0.18, gain: 0.16, type: 'square', filter: 900 });
        this.noise(0.14, 0.14, 500, 0.02, 'lowpass');
        this.tone({ freq: 420, dur: 0.1, gain: 0.08, type: 'triangle', delay: 0.08 });
        break;
      case 'phase':
        this.tone({ freq: 440, dur: 0.08, gain: 0.08, type: 'triangle' });
        this.tone({ freq: 554, dur: 0.1, gain: 0.07, type: 'sine', delay: 0.06 });
        break;
      case 'aim':
        this.tone({ freq: 980, dur: 0.04, gain: 0.05, type: 'sine' });
        break;
      case 'attack':
        this.noise(0.12, 0.18, 1400, 0, 'bandpass');
        this.tone({ freq: 220, slideTo: 90, dur: 0.16, gain: 0.18, type: 'sawtooth', filter: 1600 });
        this.tone({ freq: 880, dur: 0.06, gain: 0.08, type: 'square', delay: 0.05, filter: 2000 });
        break;
      case 'direct':
        this.noise(0.18, 0.22, 1100, 0, 'bandpass');
        this.tone({ freq: 160, slideTo: 55, dur: 0.28, gain: 0.22, type: 'sawtooth', filter: 1200 });
        this.chord([392, 494, 587], 0.2, 0.08, 'triangle');
        break;
      case 'hit':
        this.noise(0.1, 0.2, 800, 0, 'lowpass');
        this.tone({ freq: 140, slideTo: 70, dur: 0.14, gain: 0.2, type: 'square', filter: 700 });
        break;
      case 'block':
        this.tone({ freq: 300, dur: 0.08, gain: 0.12, type: 'triangle' });
        this.tone({ freq: 180, dur: 0.1, gain: 0.1, type: 'sine', delay: 0.04 });
        this.noise(0.08, 0.08, 600, 0.02, 'lowpass');
        break;
      case 'destroy':
        this.noise(0.22, 0.22, 1600, 0, 'bandpass');
        this.tone({ freq: 320, slideTo: 60, dur: 0.28, gain: 0.16, type: 'sawtooth', filter: 1800 });
        this.tone({ freq: 90, dur: 0.2, gain: 0.14, type: 'square', delay: 0.05, filter: 400 });
        break;
      case 'heal':
        this.chord([523, 659, 784], 0.28, 0.1, 'sine');
        this.tone({ freq: 1046, dur: 0.12, gain: 0.06, type: 'triangle', delay: 0.1 });
        break;
      case 'damage':
        this.noise(0.12, 0.14, 900, 0, 'lowpass');
        this.tone({ freq: 200, slideTo: 110, dur: 0.18, gain: 0.14, type: 'triangle' });
        break;
      case 'endTurn':
        this.tone({ freq: 494, slideTo: 330, dur: 0.16, gain: 0.1, type: 'sine' });
        this.noise(0.06, 0.05, 1200, 0.05, 'highpass');
        break;
      case 'win':
        this.chord([523, 659, 784, 1046], 0.45, 0.12, 'triangle');
        this.tone({ freq: 1318, dur: 0.25, gain: 0.08, type: 'sine', delay: 0.18 });
        break;
      case 'lose':
        this.tone({ freq: 311, slideTo: 155, dur: 0.45, gain: 0.14, type: 'triangle' });
        this.tone({ freq: 196, dur: 0.4, gain: 0.1, type: 'sine', delay: 0.08 });
        break;
      case 'error':
        this.tone({ freq: 180, dur: 0.1, gain: 0.12, type: 'square', filter: 600 });
        this.tone({ freq: 140, dur: 0.12, gain: 0.1, type: 'square', delay: 0.08, filter: 500 });
        break;
      case 'gy':
        this.noise(0.1, 0.08, 500, 0, 'lowpass');
        this.tone({ freq: 260, slideTo: 180, dur: 0.14, gain: 0.09, type: 'triangle' });
        break;
      default:
        break;
    }
  }
}

export const duelSfx = new DuelSfx();

/** أول تفاعل يفتح الصوت للمتصفح */
export function bindSfxUnlock() {
  if (typeof window === 'undefined') return;
  const once = () => {
    void duelSfx.unlock();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once, { once: true });
  window.addEventListener('keydown', once, { once: true });
}
