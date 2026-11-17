// Búsqueda de local por nombre/dirección y de barrio. Lógica pura (sin DOM).
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

// Se duplica el tipo de pipeline/barrios.ts (la web no importa del pipeline).
export type Barrio = {
  id: string; nombre: string; bbox: [number, number, number, number];
  geometria: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  terrazas: string[];
};
export type Resultado = { tipo: 'barrio' | 'local'; i: number }; // `i` indexa `barrios` o `terrazas` según el tipo

// El artículo inicial no cuenta para la coincidencia exacta: «malagueta» ES «La Malagueta».
const sinArticulo = (s: string) => s.replace(/^(la|el|los|las)\s+/, '');
const exacto = (nombre: string, q: string) => {
  const n = sinArticulo(normalizar(nombre)), m = sinArticulo(q);
  return n.length === m.length && contiene(n, m) === 0;
};

/** Barrios: coincidencia exacta, luego los que empiezan por la consulta, luego los que la contienen (mismo comparador que los locales). */
export function buscarBarrios(barrios: Barrio[], consulta: string, max = 3): number[] {
  const q = normalizar(consulta).trim();
  if (q.length < 2) return [];
  const puntos: [number, number][] = [];
  barrios.forEach((b, i) => {
    const p = contiene(normalizar(b.nombre), q);
    if (exacto(b.nombre, q)) puntos.push([0, i]);
    else if (p >= 0) puntos.push([p === 0 ? 1 : 2, i]);
  });
  return puntos.sort((a, b) => a[0] - b[0] || barrios[a[1]].nombre.localeCompare(barrios[b[1]].nombre) || a[1] - b[1]).slice(0, max).map(([, i]) => i);
}

/** Barrios (máx. 3) y locales mezclados. Un barrio con nombre exacto va antes que los locales; el resto de barrios, tras ellos. */
export function buscarTodo(terrazas: Terraza[], barrios: Barrio[], consulta: string, max = 8): Resultado[] {
  const q = normalizar(consulta).trim();
  const bs = buscarBarrios(barrios, consulta).map((i): Resultado => ({ tipo: 'barrio', i }));
  const exactos = bs.filter(({ i }) => exacto(barrios[i].nombre, q));
  const resto = bs.filter((r) => !exactos.includes(r));
  const ls = buscar(terrazas, consulta, max).map((i): Resultado => ({ tipo: 'local', i }));
  return [...exactos, ...ls.slice(0, Math.max(0, max - exactos.length - resto.length)), ...resto];
}
