// Easter egg: eclipse total del 2-ago-2027 en Málaga (datos IGN, hora peninsular CEST = UTC+2).
// Real: parcial 09:41:58 · totalidad 10:48:02–10:49:51 (máx. 10:48:56) · fin parcial 12:02:28.
// El selector va de 5 en 5 min, así que la "totalidad" del juego es el tramo 10:45–10:50 (cubre el 10:48 real).
// Intervalos semiabiertos [inicio, fin) en ms UTC precalculados: sin Intl, y no depende de la zona del proceso
// (el día es fijo y en agosto Madrid es siempre UTC+2).

export type FaseEclipse = 'parcial' | 'total' | 'fin';

const t = (h: number, m: number) => Date.UTC(2027, 7, 2, h - 2, m);
const TRAMOS: readonly [number, number, FaseEclipse][] = [
  [t(9, 41), t(10, 45), 'parcial'],
  [t(10, 45), t(10, 50), 'total'],    // 10:50 ya es parcial
  [t(10, 50), t(10, 55), 'parcial'],
  [t(10, 55), t(12, 3), 'fin'],       // incluye 12:02 (fin real 12:02:28); 12:03 ya es null
];

export function enEclipse(fecha: Date): FaseEclipse | null {
  const ms = fecha.getTime();
  for (const [a, b, fase] of TRAMOS) if (ms >= a && ms < b) return fase;
  return null;
}
