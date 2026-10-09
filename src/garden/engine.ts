import type { Flower, GardenState, LetterPetal } from './types';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(x => x.segment);
  }
  return Array.from(text);
}

export function petalCount(text: string): number {
  return graphemes(text).filter(x => x.trim() !== '').length;
}

function seedFrom(text: string, id: number): number {
  let h = (2166136261 ^ id) >>> 0;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function windAt(x: number, t: number): number {
  // layered sine field — from the meadow reference's wind model
  return (
    Math.sin(x * 0.0016 + t * 0.9) * 0.6 +
    Math.sin(x * 0.0042 - t * 0.37) * 0.3 +
    Math.sin(t * 0.13) * 0.35
  );
}

export function createState(reducedMotion: boolean): GardenState {
  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random(), y: Math.random() * 0.72,
    r: rand(0.4, 1.6), seed: Math.random() * 10,
  }));
  const motes = Array.from({ length: 40 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: rand(-0.008, 0.008), vy: rand(-0.004, 0.002),
    r: rand(0.6, 2.2), a: rand(0.05, 0.22), seed: Math.random() * 10,
  }));
  return {
    flowers: [], motes, ripples: [], stars,
    wind: 0, gust: 0, gustTimer: rand(20, 45),
    time: 0, reducedMotion,
    pointer: { x: -1, y: -1, down: false, downAt: 0, active: false },
  };
}

export function makeFlower(text: string, rootX: number, rootY: number, stemLen: number, id: number): Flower {
  const chars = graphemes(text).filter(c => c.trim().length > 0);
  if (chars.length > 42) throw new Error('A memory may contain at most 42 visible graphemes');
  const n = chars.length;
  const rnd = seeded(seedFrom(text, id));
  const letters: LetterPetal[] = chars.map((ch, i) => ({
    ch,
    angle: (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2,
    radius: 75,
    vitality: 1, state: 'attached',
    x: 0, y: 0, vx: 0, vy: 0,
    seed: rnd() * 100,
    size: 17,
  }));
  return {
    id, text, rootX, rootY, stemLen, letters,
    growth: 0, state: 'growing', bornAt: Date.now(),
    seed: rnd() * 1000, hue: -14 + rnd() * 32,
  };
}

export function flowerHead(f: Flower, w: number, h: number, t: number, reduced: boolean) {
  const gx = f.rootX * w;
  const gy = f.rootY * h;
  const sway = reduced ? 0 : Math.sin(t * 0.7 + f.seed) * (7 + f.stemLen * 0.03) * (0.4 + 0.6 * f.growth);
  const bend = reduced ? 0 : Math.sin(t * 0.43 + f.seed * 2) * 4;
  return { hx: gx + sway + bend, hy: gy - f.stemLen * f.growth, gx, gy };
}

const DECAY_RATE = 1 / 300;      // ~5 minutes to full erosion, untended
const DETACH_THRESHOLD = 0.38;
const TEND_RADIUS = 150;
const TEND_RATE = 0.22;

export interface SimEvents {
  onDetach?: (ch: string) => void;
  onTend?: () => void;
  onGust?: (starting: boolean) => void;
}

export function step(s: GardenState, w: number, h: number, dt: number, ev: SimEvents) {
  s.time += dt;
  const t = s.time;
  const rm = s.reducedMotion;

  // gusts roll through every so often
  s.gustTimer -= dt;
  if (s.gustTimer <= 0) {
    if (s.gust <= 0) { ev.onGust?.(true); s.gustTimer = rand(3.5, 5.5); s.gust = 0.001; }
    else { ev.onGust?.(false); s.gustTimer = rand(40, 80); s.gust = 0; }
  }
  if (s.gust > 0) s.gust = Math.min(1, s.gust + dt * 1.6);
  else if (!rm && s.gustTimer < 40) s.gust = Math.max(0, s.gust - dt * 0.8);

  s.wind = windAt(t * 60, t) * (0.35 + s.gust * 1.5);

  // motes drift
  if (!rm) for (const m of s.motes) {
    m.x += (m.vx + s.wind * 0.012) * dt * 60;
    m.y += m.vy * dt * 60;
    if (m.x < -0.05) m.x = 1.05; if (m.x > 1.05) m.x = -0.05;
    if (m.y < -0.05) m.y = 1.05; if (m.y > 1.05) m.y = -0.05;
  }

  // ripples fade
  s.ripples = s.ripples.filter(r => (r.r += dt * 160) < 260 && (r.a -= dt * 0.9) > 0);

  const px = s.pointer.x, py = s.pointer.y;
  const tendingGlobal = s.pointer.active;

  for (const f of s.flowers) {
    if (f.state === 'growing') {
      f.growth = Math.min(1, f.growth + dt * (rm ? 4 : 0.7));
      if (f.growth >= 1) f.state = 'alive';
    }
    // Released petals must still take their final flight, even after the flower
    // becomes a memorial. They are not allowed to return to a released bloom.
    if (f.state === 'released') {
      for (const L of f.letters) {
        if (L.state !== 'drifting') continue;
        L.vx += s.wind * 26 * dt;
        L.vx *= (1 - 0.28 * dt);
        L.vy -= 14 * dt;
        if (!rm) { L.x += L.vx * dt; L.y += L.vy * dt; }
        L.vitality = Math.max(0, L.vitality - dt * (rm ? 0.6 : 0.13));
        if (L.vitality <= 0 || L.y < -80) L.state = 'gone';
      }
      continue;
    }
    if (f.state !== 'alive' && f.state !== 'growing') continue;

    const { hx, hy } = flowerHead(f, w, h, t, rm);
    const distP = Math.hypot(px - hx, py - hy);
    const tending = tendingGlobal && distP < TEND_RADIUS && f.state === 'alive';
    if (tending) {
      ev.onTend?.();
      if (!rm && Math.random() < dt * 6) s.ripples.push({ x: px, y: py, r: 8, a: 0.35 });
    }

    const decayMul = (1 + s.gust * 2.2) * (rm ? 0.5 : 1);

    for (const L of f.letters) {
      if (L.state === 'attached') {
        L.vitality = Math.max(0, Math.min(1,
          L.vitality - DECAY_RATE * decayMul * dt * rand(0.7, 1.3) + (tending ? TEND_RATE * dt : 0)));
        if (L.vitality < DETACH_THRESHOLD && Math.random() < dt * (rm ? 0.02 : 0.55)) {
          L.state = 'drifting';
          const a = L.angle;
          L.x = hx + Math.cos(a) * L.radius;
          L.y = hy + Math.sin(a) * L.radius;
          L.vx = Math.cos(a) * rand(6, 22) + s.wind * 18;
          L.vy = Math.sin(a) * rand(6, 18) - rand(4, 14);
          ev.onDetach?.(L.ch);
        }
      } else if (L.state === 'drifting') {
        if (tending) {
          // attention pulls letters home
          const homeA = L.angle;
          const homeX = hx + Math.cos(homeA) * L.radius;
          const homeY = hy + Math.sin(homeA) * L.radius;
          const dx = homeX - L.x, dy = homeY - L.y;
          const d = Math.hypot(dx, dy);
          if (d < 14) { L.state = 'attached'; L.vitality = Math.max(L.vitality, 0.62); }
          else if (d < 260) { L.vx += (dx / d) * 320 * dt; L.vy += (dy / d) * 320 * dt; }
        }
        if (!rm) {
          L.vx += s.wind * 26 * dt;
          L.vy += Math.sin(t * 2 + L.seed) * 9 * dt - 2.5 * dt;
          L.vx *= (1 - 0.35 * dt); L.vy *= (1 - 0.3 * dt);
          L.x += L.vx * dt; L.y += L.vy * dt;
        } else {
          L.vitality -= dt * 0.12;
        }
        L.vitality -= dt * (tending ? 0 : 0.028);
        const off = L.x < -80 || L.x > w + 80 || L.y < -80 || L.y > h + 80;
        if (L.vitality <= 0 || off) L.state = 'gone';
      }
    }

    // fully eroded?
    if (f.state === 'alive' && f.letters.length > 0 && f.letters.every(L => L.state === 'gone')) {
      f.state = 'faded';
    }
  }
}

export function releaseFlower(s: GardenState, f: Flower, w: number, h: number, ev: SimEvents) {
  if (f.state !== 'alive' && f.state !== 'growing') return;
  const { hx, hy } = flowerHead(f, w, h, s.time, s.reducedMotion);
  for (const L of f.letters) {
    if (L.state !== 'attached') continue;
    L.state = 'drifting';
    const a = L.angle + rand(-0.3, 0.3);
    L.x = hx + Math.cos(a) * L.radius;
    L.y = hy + Math.sin(a) * L.radius;
    const sp = rand(60, 170);
    L.vx = Math.cos(a - Math.PI / 2) * sp * 0.4 + s.wind * 40 + rand(-20, 60);
    L.vy = -sp;
    L.vitality = Math.max(L.vitality, 0.75);
    ev.onDetach?.(L.ch);
  }
  f.state = 'released';
  for (let i = 0; i < 5; i++) s.ripples.push({ x: hx, y: hy, r: 10 + i * 18, a: 0.4 });
}

export function vitalityOf(f: Flower): number {
  if (f.state === 'released' || f.state === 'faded') return 0;
  const att = f.letters.filter(L => L.state !== 'gone');
  if (!att.length) return 0;
  return att.reduce((s, L) => s + (L.state === 'attached' ? L.vitality : L.vitality * 0.4), 0) / f.letters.length;
}

// Accessible alternative to pointer-based care. A deliberate action restores
// attached petals and calls back nearby drifting ones without resurrecting gone letters.
export function tendFlower(s: GardenState, f: Flower, w: number, h: number): boolean {
  if (f.state !== 'alive' && f.state !== 'growing') return false;
  const { hx, hy } = flowerHead(f, w, h, s.time, s.reducedMotion);
  let changed = false;
  for (const l of f.letters) {
    if (l.state === 'gone') continue;
    if (l.state === 'drifting') { l.state = 'attached'; changed = true; }
    l.vitality = Math.min(1, l.vitality + 0.23);
    changed = true;
  }
  if (changed) s.ripples.push({ x: hx, y: hy, r: 8, a: 0.5 });
  return changed;
}
