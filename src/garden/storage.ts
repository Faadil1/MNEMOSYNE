import type { Flower, LetterPetal } from './types';
import { makeFlower } from './engine';

const KEY = 'mnemosyne.garden.v2';
const LEGACY_KEY = 'mnemosyne.garden.v1';
export interface GardenSave { version: 2; savedAt: number; flowers: Flower[] }
const states = new Set(['growing', 'alive', 'released', 'faded']);
const petalStates = new Set(['attached', 'drifting', 'gone']);
const finite = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;

function safeFlower(data: unknown): Flower | null {
  if (!data || typeof data !== 'object') return null;
  const a = data as Partial<Flower>;
  if (typeof a.text !== 'string' || a.text.length > 500 || !Array.isArray(a.letters)) return null;
  const letters: LetterPetal[] = a.letters.slice(0, 100).flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.ch !== 'string') return [];
    const l = raw as LetterPetal;
    return [{
      ch: l.ch.slice(0, 20), angle: finite(l.angle, 0), radius: finite(l.radius, 35),
      vitality: Math.max(0, Math.min(1, finite(l.vitality, 1))),
      state: petalStates.has(l.state) ? l.state : 'attached',
      x: finite(l.x, 0), y: finite(l.y, 0), vx: finite(l.vx, 0), vy: finite(l.vy, 0),
      seed: finite(l.seed, 1), size: finite(l.size, 14),
    }];
  });
  return {
    id: finite(a.id, Date.now()), text: a.text, rootX: finite(a.rootX, 0.5),
    rootY: finite(a.rootY, 0.82), stemLen: finite(a.stemLen, 90), letters,
    growth: finite(a.growth, 1), state: a.state && states.has(a.state) ? a.state : 'alive',
    bornAt: finite(a.bornAt, Date.now()), seed: finite(a.seed, 1), hue: finite(a.hue, 0),
  };
}

export function saveGarden(flowers: Flower[]): boolean {
  try {
    const payload: GardenSave = { version: 2, savedAt: Date.now(), flowers };
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch { return false; }
}

export function loadGarden(): { flowers: Flower[]; savedAt: number; migrated: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<GardenSave>;
      if (data.version === 2 && Array.isArray(data.flowers)) {
        return { flowers: data.flowers.map(safeFlower).filter((f): f is Flower => !!f),
          savedAt: finite(data.savedAt, Date.now()), migrated: false };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as Array<{ text: string; rootX: number; vitality: number; state: string }>;
      if (Array.isArray(data)) {
        const flowers = data.slice(0, 9).filter(x => x && typeof x.text === 'string').map((x, i) => {
          const f = makeFlower(x.text, finite(x.rootX, 0.5), 0.82, 160, Date.now() + i);
          f.growth = 1;
          // V1 stored an average only; individual lost petals cannot be reconstructed.
          const v = Math.max(0, Math.min(1, finite(x.vitality, 0.8)));
          f.state = x.state === 'faded' ? 'faded' : 'alive';
          f.letters.forEach(l => { l.vitality = v; if (f.state === 'faded') l.state = 'gone'; });
          return f;
        });
        return { flowers, savedAt: Date.now(), migrated: true };
      }
    }
  } catch { /* Malformed storage must not prevent entry into the garden. */ }
  return { flowers: [], savedAt: Date.now(), migrated: false };
}

export function clearGardenStorage() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}

export function exportGarden(flowers: Flower[]): string {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), flowers }, null, 2);
}
