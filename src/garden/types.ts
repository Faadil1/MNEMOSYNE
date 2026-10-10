// MNEMOSYNE — core simulation types
export interface LetterPetal {
  ch: string;
  angle: number;      // radial angle around flower head
  radius: number;     // base radius from head center
  vitality: number;   // 1 = vivid, 0 = gone
  state: 'attached' | 'drifting' | 'gone';
  x: number; y: number;   // drift position
  vx: number; vy: number; // drift velocity
  seed: number;
  size: number;
}

export interface Flower {
  id: number;
  text: string;
  rootX: number;      // fraction of viewport width (0..1) for resize stability
  rootY: number;      // fraction of viewport height
  stemLen: number;    // px
  letters: LetterPetal[];
  growth: number;     // 0..1 planting animation
  state: 'growing' | 'alive' | 'released' | 'faded';
  bornAt: number;
  seed: number;
  hue: number;        // subtle per-flower warmth
}

export interface Mote {
  x: number; y: number; vx: number; vy: number; r: number; a: number; seed: number;
}

export interface Ripple { x: number; y: number; r: number; a: number; }

export interface GardenState {
  flowers: Flower[];
  motes: Mote[];
  ripples: Ripple[];
  stars: { x: number; y: number; r: number; seed: number }[];
  wind: number;          // current wind strength -1..1
  gust: number;          // 0..1 gust envelope
  gustTimer: number;
  time: number;
  pointer: { x: number; y: number; down: boolean; downAt: number; active: boolean };
  reducedMotion: boolean;
}
