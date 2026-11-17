// Barrios de Málaga: simplifica los polígonos municipales y asigna cada terraza a su barrio
// (punto en polígono). Genera src/data/barrios.json SIN tocar src/data/terrazas.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Pos = [number, number]; // [lon, lat]
export type Anillo = Pos[];
export type Poligono = Anillo[]; // [exterior, ...agujeros]
export type Geometria = { type: 'Polygon'; coordinates: Poligono } | { type: 'MultiPolygon'; coordinates: Poligono[] };
export type Barrio = {
  id: string; nombre: string; bbox: [number, number, number, number];
  geometria: Geometria; terrazas: string[];
};

const poligonos = (g: Geometria): Poligono[] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

/** Ray casting sobre un anillo (par-impar). */
function dentroDeAnillo([x, y]: Pos, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Punto en Polygon/MultiPolygon: dentro del exterior y fuera de todos los agujeros. */
export const dentroDeGeometria = (p: Pos, g: Geometria): boolean =>
  poligonos(g).some(([exterior, ...agujeros]) => dentroDeAnillo(p, exterior) && !agujeros.some((a) => dentroDeAnillo(p, a)));

// Metros por grado en Málaga (36.7°N): suficiente para medir tolerancias de unos metros.
const M_LAT = 110_900, M_LON = 111_320 * Math.cos((36.7 * Math.PI) / 180);

/** Douglas-Peucker en metros sobre un anillo cerrado; conserva ≥4 puntos o devuelve null si se degenera. */
export function simplificarAnillo(anillo: Anillo, tolerancia: number): Anillo | null {
  const pts = anillo.slice(0, -1).map(([x, y]) => [x * M_LON, y * M_LAT]);
  const dist = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const guardar = new Set<number>([0, pts.length - 1]);
  const pila: [number, number][] = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop()!;
    let max = 0, k = -1;
    for (let i = a + 1; i < b; i++) { const d = dist(pts[i], pts[a], pts[b]); if (d > max) { max = d; k = i; } }
    if (k >= 0 && max > tolerancia) { guardar.add(k); pila.push([a, k], [k, b]); }
  }
  // 5 decimales ≈ 1 m: de sobra tras simplificar y recorta el peso del JSON.
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  const sal = [...guardar].sort((a, b) => a - b).map((i) => [r(anillo[i][0]), r(anillo[i][1])] as Pos);
  if (sal.length < 3) return null;
  return [...sal, sal[0]];
}

function simplificarGeometria(g: Geometria, tolerancia: number): Geometria {
  const poli = poligonos(g).flatMap((p) => {
    const [ext, ...ag] = p.map((a) => simplificarAnillo(a, tolerancia));
    return ext ? [[ext, ...ag.filter((a): a is Anillo => a !== null)]] : []; // un agujero degenerado se descarta; un exterior, el polígono
  });
  return poli.length === 1 ? { type: 'Polygon', coordinates: poli[0] } : { type: 'MultiPolygon', coordinates: poli };
}

type Entrada = { id: string; nombre: string; geometria: Geometria };
type TerrazaMin = { id: string; lon: number; lat: number };

/** Barrios simplificados + ids de terrazas dentro de cada uno. `sinBarrio` = ids que no caen en ninguno. */
export function construirBarrios(barrios: Entrada[], terrazas: TerrazaMin[], tolerancia = 5) {
  const cajas = barrios.map((b) => {
    const xs = poligonos(b.geometria).flatMap((p) => p[0].map((q) => q[0])), ys = poligonos(b.geometria).flatMap((p) => p[0].map((q) => q[1]));
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as Barrio['bbox'];
  });
  const ids = barrios.map((): string[] => []);
  const sinBarrio: string[] = [];
  for (const t of terrazas) {
    // Se asigna con la geometría ORIGINAL (no la simplificada) para no mover locales de borde. Primer barrio que lo contiene.
    const i = barrios.findIndex((b, k) => t.lon >= cajas[k][0] && t.lon <= cajas[k][2] && t.lat >= cajas[k][1] && t.lat <= cajas[k][3]
      && dentroDeGeometria([t.lon, t.lat], b.geometria));
    if (i < 0) sinBarrio.push(t.id); else ids[i].push(t.id);
  }
  const lista: Barrio[] = [];
  barrios.forEach((b, i) => {
    if (!ids[i].length) return; // un barrio sin locales no sirve de nada en un buscador de terrazas
    lista.push({ id: b.id, nombre: b.nombre, bbox: cajas[i], geometria: simplificarGeometria(b.geometria, tolerancia), terrazas: ids[i] });
  });
  return { barrios: lista, sinBarrio };
}

/** Del GeoJSON municipal: nombre con relleno de espacios recortado; los '?' (si los hubiera) se conservan como en las terrazas. */
export function leerBarrios(geojson: any): Entrada[] {
  return geojson.features.map((f: any) => ({
    id: String(f.properties.ID_BARRIO),
    nombre: String(f.properties.NOMBARRIO).trim(),
    geometria: quitarCota(f.geometry), // el dato trae una 3.ª coordenada (cota ~0) que sobra
  }));
}

function quitarCota(g: any): Geometria {
  const a = (r: any[]): Anillo => r.map((p) => [p[0], p[1]]);
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: g.coordinates.map(a) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map(a)) };
}

if (import.meta.main) {
  const raiz = resolve(import.meta.dirname, '..');
  const entrada = leerBarrios(JSON.parse(readFileSync(resolve(raiz, 'pipeline/raw/barrios.geojson'), 'utf8')));
  const terrazas = JSON.parse(readFileSync(resolve(raiz, 'src/data/terrazas.json'), 'utf8'));
  const { barrios, sinBarrio } = construirBarrios(entrada, terrazas);
  writeFileSync(resolve(raiz, 'src/data/barrios.json'), JSON.stringify(barrios));
  console.log({ barriosMunicipio: entrada.length, barriosConLocales: barrios.length, terrazas: terrazas.length, sinBarrio: sinBarrio.length });
}
