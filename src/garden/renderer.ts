// MNEMOSYNE — renderer: draws the whole garden on a 2D canvas
import type { Flower, GardenState } from './types';
import { flowerHead, vitalityOf, windAt } from './engine';

const IVORY = '#ece4d1';
const ICY = '#dcf5ff';

function stemPath(ctx: CanvasRenderingContext2D, f: Flower, w: number, h: number, t: number, rm: boolean) {
  const { hx, hy, gx, gy } = flowerHead(f, w, h, t, rm);
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  const mx = (gx + hx) / 2 + (rm ? 0 : Math.sin(t * 0.5 + f.seed) * 14);
  ctx.quadraticCurveTo(mx, (gy + hy) / 2, hx, hy);
}

export function render(s: GardenState, ctx: CanvasRenderingContext2D, w: number, h: number) {
  const t = s.time;
  const rm = s.reducedMotion;

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04060c');
  g.addColorStop(0.55, '#080d18');
  g.addColorStop(1, '#0b1220');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stars
  for (const st of s.stars) {
    const tw = rm ? 0.6 : 0.35 + 0.65 * Math.abs(Math.sin(t * 0.6 + st.seed * 7));
    ctx.globalAlpha = 0.5 * tw * (st.r / 1.6);
    ctx.fillStyle = ICY;
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // quiet terrain: a horizon and strata rather than a generic game floor
  const gy = h * 0.82;
  ctx.strokeStyle = 'rgba(120,140,170,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, gy + 14);
  for (let x = 0; x <= w; x += 24) {
    ctx.lineTo(x, gy + 10 + Math.sin(x * 0.011 + 2) * 6 + Math.sin(x * 0.031) * 3);
  }
  ctx.stroke();
  const gg = ctx.createLinearGradient(0, gy + 8, 0, h);
  gg.addColorStop(0, 'rgba(10,16,26,0)');
  gg.addColorStop(1, 'rgba(14,22,34,0.9)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, gy + 8, w, h - gy);

  // motes
  for (const m of s.motes) {
    ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t + m.seed * 9));
    ctx.fillStyle = '#cfe0e8';
    ctx.beginPath();
    ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ripples (tending / release)
  for (const r of s.ripples) {
    ctx.globalAlpha = Math.max(0, r.a);
    ctx.strokeStyle = '#cfe6da';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // flowers
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of s.flowers) {
    drawFlower(s, ctx, f, w, h, t);
  }

  // wind veil during gusts
  if (s.gust > 0.05 && !rm) {
    ctx.globalAlpha = s.gust * 0.05;
    ctx.fillStyle = '#b9d4e2';
    for (let i = 0; i < 5; i++) {
      const y = ((t * 60 * (0.4 + i * 0.13)) % (h + 200)) - 100;
      ctx.fillRect(0, y, w, 1.2);
    }
    ctx.globalAlpha = 1;
  }
}

function drawFlower(s: GardenState, ctx: CanvasRenderingContext2D, f: Flower, w: number, h: number, t: number) {
  const rm = s.reducedMotion;
  const { hx, hy, gx, gy } = flowerHead(f, w, h, t, rm);
  const ghost = f.state === 'released' || f.state === 'faded';
  const vit = vitalityOf(f);

  // stem
  stemPath(ctx, f, w, h, t, rm);
  ctx.strokeStyle = ghost ? 'rgba(110,130,120,0.16)' : `rgba(126,158,138,${0.35 + vit * 0.4})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // small leaves on stem
  if (!ghost && f.growth > 0.6) {
    const la = rm ? 0 : Math.sin(t * 0.8 + f.seed) * 0.15;
    ctx.strokeStyle = `rgba(126,158,138,${0.3 * f.growth})`;
    ctx.beginPath();
    ctx.moveTo(gx + (hx - gx) * 0.4, gy + (hy - gy) * 0.4);
    ctx.quadraticCurveTo(gx - 26, gy - f.stemLen * 0.42, gx - 40 * Math.cos(la), gy - f.stemLen * 0.5);
    ctx.stroke();
  }

  if (ghost) {
    // pale memorial ring
    ctx.globalAlpha = f.state === 'released' ? 0.22 : 0.12;
    ctx.strokeStyle = IVORY;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(hx, hy, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (f.state === 'released') {
      // A released flower becomes a memorial immediately, but its remaining
      // drifting letters continue their last visible journey into the sky.
      for (const L of f.letters) {
        if (L.state !== 'drifting') continue;
        ctx.save();
        ctx.translate(L.x, L.y);
        if (!rm) ctx.rotate(L.angle + t * 0.5);
        ctx.globalAlpha = Math.max(0, Math.min(1, L.vitality));
        ctx.fillStyle = IVORY;
        ctx.font = `${L.size}px Georgia, 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#e8caa0';
        ctx.shadowBlur = 8;
        ctx.fillText(L.ch, 0, 0);
        ctx.restore();
      }
    }
    return;
  }

  // heart glow
  const glow = 0.25 + vit * 0.75;
  const rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60 * f.growth);
  rg.addColorStop(0, `rgba(240,226,190,${0.35 * glow * f.growth})`);
  rg.addColorStop(1, 'rgba(240,226,190,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(hx, hy, 60 * f.growth, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(243,231,196,${0.85 * f.growth})`;
  ctx.beginPath();
  ctx.arc(hx, hy, 5.5 * f.growth, 0, Math.PI * 2);
  ctx.fill();

  // letter petals
  const breathe = rm ? 1 : 1 + Math.sin(t * 0.9 + f.seed) * 0.03;
  for (const L of f.letters) {
    if (L.state === 'gone') continue;
    const bloom = Math.min(1, f.growth * 1.6);
    let x: number, y: number, rot: number;
    if (L.state === 'attached') {
      const wob = rm ? 0 : Math.sin(t * 1.3 + L.seed) * 2.2;
      x = hx + Math.cos(L.angle) * (L.radius * breathe + wob) * bloom;
      y = hy + Math.sin(L.angle) * (L.radius * breathe + wob) * bloom;
      rot = L.angle + Math.PI / 2 + (rm ? 0 : Math.sin(t * 0.7 + L.seed) * 0.08);
    } else {
      x = L.x; y = L.y;
      rot = L.angle + (rm ? 0 : t * 0.6 + L.seed);
    }
    const a = Math.max(0, Math.min(1, L.vitality)) * bloom;
    // low-vitality letters flicker like dying embers
    const flicker = L.vitality < 0.5 && !rm ? 0.75 + 0.25 * Math.sin(t * 9 + L.seed * 3) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = a * flicker;
    ctx.font = `${L.state === 'drifting' ? L.size * 0.9 : L.size}px Georgia, 'Times New Roman', 'Songti SC', 'Noto Serif CJK SC', serif`;
    const warm = Math.min(245, 225 + Math.round(f.hue));
    ctx.fillStyle = L.vitality > 0.55 ? IVORY : `rgb(${warm},${190 + Math.round(30 * L.vitality)},150)`;
    ctx.shadowColor = 'rgba(240,225,190,0.55)';
    ctx.shadowBlur = 6 * L.vitality;
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function windVisible(s: GardenState): number {
  return windAt(s.time * 60, s.time) * (0.35 + s.gust * 1.5);
}
