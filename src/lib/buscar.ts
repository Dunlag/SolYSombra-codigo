// Búsqueda de local por nombre/dirección y de barrio. Lógica pura (sin DOM).
import type { Zona } from './alias.ts';
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
export type Resultado = { tipo: 'barrio' | 'zona' | 'local'; i: number }; // `i` indexa `barrios`, `zonas` o `terrazas` según el tipo

// El artículo inicial no cuenta para la coincidencia exacta: «malagueta» ES «La Malagueta».
const sinArticulo = (s: string) => s.replace(/^(la|el|los|las)\s+/, '');
const exacto = (nombre: string, q: string) => {
  const n = sinArticulo(normalizar(nombre)), m = sinArticulo(q);
  return n.length === m.length && contiene(n, m) === 0;
};

const rango = (textos: string[], q: string): number =>
  Math.min(...textos.map((x) => { const p = contiene(normalizar(x), q); return exacto(x, q) ? 0 : p === 0 ? 1 : p > 0 ? 2 : 3; }));

/** Barrios y zonas: coincidencia exacta (del nombre o de un alias), luego prefijo, luego «contiene». Una zona que apunta a un
 *  único barrio real no se lista: sus alias cuentan para ese barrio (sin duplicados). */
export function buscarAgrupados(barrios: Barrio[], zonas: Zona[], consulta: string, max = 4): (Resultado & { r: number })[] {
  const q = normalizar(consulta).trim();
  if (q.length < 2) return [];
  const extra = new Map<number, string[]>();
  zonas.forEach((z) => z.barrio !== undefined && extra.set(z.barrio, [...(extra.get(z.barrio) ?? []), z.nombre, z.nombreEn, ...z.alias]));
  const c: (Resultado & { r: number; n: string })[] = [
    ...barrios.map((b, i) => ({ tipo: 'barrio' as const, i, n: b.nombre, r: rango([b.nombre, ...(extra.get(i) ?? [])], q) })),
    ...zonas.flatMap((z, i) => (z.barrio === undefined ? [{ tipo: 'zona' as const, i, n: z.nombre, r: rango([z.nombre, z.nombreEn, ...z.alias], q) }] : [])),
  ];
  return c.filter((x) => x.r < 3).sort((a, b) => a.r - b.r || a.n.localeCompare(b.n) || a.i - b.i).slice(0, max);
}

/** Barrios: coincidencia exacta, luego los que empiezan por la consulta, luego los que la contienen (mismo comparador que los locales). */
export const buscarBarrios = (barrios: Barrio[], consulta: string, max = 3): number[] =>
  buscarAgrupados(barrios, [], consulta, max).map((x) => x.i);

/** Barrios/zonas (máx. 4) y locales mezclados. Los exactos van antes que los locales; el resto, tras ellos. */
export function buscarTodo(terrazas: Terraza[], barrios: Barrio[], consulta: string, max = 8, zonas: Zona[] = []): Resultado[] {
  const ag = buscarAgrupados(barrios, zonas, consulta).map(({ tipo, i, r }) => ({ tipo, i, r }));
  const exactos = ag.filter((x) => x.r === 0).map(({ tipo, i }): Resultado => ({ tipo, i }));
  const resto = ag.filter((x) => x.r !== 0).map(({ tipo, i }): Resultado => ({ tipo, i }));
  const ls = buscar(terrazas, consulta, max).map((i): Resultado => ({ tipo: 'local', i }));
  return [...exactos, ...ls.slice(0, Math.max(0, max - exactos.length - resto.length)), ...resto];
}
