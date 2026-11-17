// Búsqueda de local por nombre/dirección. Lógica pura (sin DOM).
import type { Terraza } from './terrazas.ts';

/** Minúsculas y sin acentos. */
export const normalizar = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Los datos traen '?' donde había una tilde/eñe: en el TEXTO, '?' vale por cualquier carácter.
// shortcut: comparación O(n·m) por terraza, sobra para 1665 filas; indexar si crece 10×.
const contiene = (texto: string, q: string): number => {
  for (let i = 0; i + q.length <= texto.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length && ok; j++) ok = texto[i + j] === q[j] || texto[i + j] === '?';
    if (ok) return i;
  }
  return -1;
};

/** Índices (en `terrazas`) de las coincidencias: primero nombre que empieza por la consulta, luego nombre, luego dirección. */
export function buscar(terrazas: Terraza[], consulta: string, max = 8): number[] {
  const q = normalizar(consulta).trim();
  if (q.length < 2) return [];
  const puntos: [number, number][] = []; // [puntuación (menor = mejor), índice]
  terrazas.forEach((t, i) => {
    const p = contiene(normalizar(t.nombre), q);
    if (p === 0) puntos.push([0, i]);
    else if (p > 0) puntos.push([1, i]);
    else if (contiene(normalizar(t.direccion), q) >= 0) puntos.push([2, i]);
  });
  return puntos.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, max).map(([, i]) => i);
}
