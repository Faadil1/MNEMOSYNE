import type { Flower } from './types';

// Only living flowers occupy planting plots. Released / faded memories live in
// the persistent memorial journal rather than blocking new growth.
export function layoutFlowers(flowers: Flower[], width: number, height: number) {
  const alive = flowers.filter(f => f.state === 'growing' || f.state === 'alive')
    .sort((a, b) => a.bornAt - b.bornAt || a.id - b.id);
  const n = alive.length;
  if (!n) return;
  const columns = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / columns);
  const firstY = rows === 1 ? 0.47 : rows === 2 ? 0.34 : height < 700 ? 0.34 : 0.29;
  const lastY = rows === 1 ? firstY : rows === 2 ? 0.64 : height < 700 ? 0.64 : 0.67;
  const cell = width / columns;
  const verticalCell = rows === 1 ? height * 0.55 : (lastY - firstY) * height / (rows - 1);
  const radius = Math.max(24, Math.min(
    n === 1 ? 102 : n <= 4 ? 82 : 70,
    cell * (width < 550 ? 0.33 : 0.34),
    verticalCell * 0.31,
  ));
  const stem = n === 1 ? Math.min(height * 0.26, 185)
    : Math.min(rows === 3 ? 55 : 100, verticalCell * 0.35);

  alive.forEach((f, index) => {
    const row = Math.floor(index / columns);
    const rowSize = Math.min(columns, n - row * columns);
    const col = index - row * columns;
    const x = (col + 0.5 + (columns - rowSize) / 2) / columns;
    const y = rows === 1 ? firstY : firstY + row * (lastY - firstY) / (rows - 1);
    f.rootX = x;
    f.rootY = y + stem / height;
    f.stemLen = stem;
    const count = f.letters.length;
    const rings = Math.ceil(count / 14);
    const ringCount = Math.max(1, rings);
    f.letters.forEach((letter, i) => {
      const ring = i % ringCount;
      const slot = Math.floor(i / ringCount);
      const items = Math.ceil((count - ring) / ringCount);
      letter.angle = (slot / items) * Math.PI * 2 - Math.PI / 2 + ring * 0.12;
      letter.radius = radius * (ringCount === 1 ? 1 : 0.52 + 0.48 * ring / (ringCount - 1));
      letter.size = Math.max(8.5, Math.min(21, radius * (count > 22 ? 0.19 : 0.25)));
    });
  });
}

export function flowerRadius(f: Flower) {
  return Math.max(24, ...f.letters.map(l => l.radius)) + 12;
}
