export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Picks a cols x rows grid for n panes that keeps panes closest to a 2.5:1 char aspect. */
export function grid(n: number, cols: number, rows: number): { c: number; r: number } {
  if (n <= 0) return { c: 1, r: 1 };
  let best = { c: 1, r: n, score: Infinity };
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const w = cols / c;
    const h = rows / r;
    if (w < 20 && c > 1) break;
    const score = Math.abs(Math.log(w / h / 2.5)) + (c * r - n) * 0.05;
    if (score < best.score) best = { c, r, score };
  }
  return { c: best.c, r: best.r };
}

/** Tiles n panes over the screen like tmux "tiled": last row stretches to fill. */
export function tile(n: number, cols: number, rows: number): Rect[] {
  const { c, r } = grid(n, cols, rows);
  const rects: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / c);
    const inRow = row === r - 1 ? n - row * c : c;
    const col = i - row * c;
    const x0 = Math.floor((col * cols) / inRow);
    const x1 = Math.floor(((col + 1) * cols) / inRow);
    const y0 = Math.floor((row * rows) / r);
    const y1 = Math.floor(((row + 1) * rows) / r);
    rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return rects;
}
