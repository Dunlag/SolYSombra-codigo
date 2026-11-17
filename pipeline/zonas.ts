// Zonas compuestas (varios barrios): UNA demarcación exterior por zona, sin líneas interiores.
// Se une a partir de los polígonos ORIGINALES (sin simplificar: unir los ya simplificados deja rendijas entre vecinos)
// y se simplifica DESPUÉS. Salida: src/data/zonas.json = [{id, geometria, bbox}]. terrazas.json no se toca.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZONAS, resolverZonas, type Caja, type ZonaDef, type ZonaUnida } from '../src/lib/alias.ts';
import { M_LAT, M_LON, dentroDeGeometria, simplificarAnillo, type Anillo, type Geometria, type Poligono, type Pos } from './barrios.ts';

const clave = (p: Pos) => `${p[0].toFixed(8)},${p[1].toFixed(8)}`;
/** Área con signo en m² (positiva = antihoraria, como los exteriores del dataset). */
export function areaM2(r: Anillo): number {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * M_LON * r[i][1] * M_LAT - r[i][0] * M_LON * r[j][1] * M_LAT;
  return s / 2;
}
const dentro = ([x, y]: Pos, r: Anillo) => {
  let d = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) d = !d;
  return d;
};

/**
 * Disolución por cancelación de aristas: una arista A→B de un polígono y B→A de su vecino son frontera interior y se
 * eliminan; las que quedan forman el contorno exterior (y los agujeros reales). Exige exteriores antihorarios y
 * agujeros horarios (el dataset municipal lo cumple y comparte vértices con sus vecinos, 8 decimales).
 * Anillos/partes de menos de `minArea` m² (rendijas, micro-agujeros) se descartan.
 */
export function unir(polis: Poligono[], minArea = 50): Poligono[] {
  const aristas = new Map<string, Pos[]>(); // "a>b" -> [a, b] (con multiplicidad vía longitud)
  const cuenta = new Map<string, number>();
  const salen = new Map<string, string[]>(); // origen -> claves de aristas pendientes
  const pts = new Map<string, Pos>();
  for (const p of polis) for (const r of p) for (let i = 0; i < r.length - 1; i++) {
    const a = clave(r[i]), b = clave(r[i + 1]);
    if (a === b) continue;
    pts.set(a, r[i]); pts.set(b, r[i + 1]);
    const inv = `${b}>${a}`;
    if (cuenta.get(inv)) { cuenta.set(inv, cuenta.get(inv)! - 1); continue; } // cancela con su inversa
    const k = `${a}>${b}`;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    aristas.set(k, [r[i], r[i + 1]]);
  }
  for (const [k, n] of cuenta) for (let i = 0; i < n; i++) { const a = k.split('>')[0]; salen.set(a, [...(salen.get(a) ?? []), k]); }
  // Encadenar aristas en anillos. Si un vértice tiene varias salidas (contacto en un punto) se toma la primera.
  const anillos: Anillo[] = [];
  for (const [origen] of salen) {
    while (salen.get(origen)?.length) {
      const anillo: Anillo = [pts.get(origen)!];
      let actual = origen;
      for (;;) {
        const k = salen.get(actual)?.shift();
        if (!k) break; // anillo abierto (dato inconsistente): se descarta abajo
        actual = k.split('>')[1];
        anillo.push(pts.get(actual)!);
        if (actual === origen) break;
      }
      if (anillo.length > 3 && clave(anillo[0]) === clave(anillo[anillo.length - 1])) anillos.push(anillo);
    }
  }
  const exteriores = anillos.filter((r) => areaM2(r) >= minArea);
  const agujeros = anillos.filter((r) => areaM2(r) <= -minArea);
  const partes: Poligono[] = exteriores.map((r) => [r]);
  for (const h of agujeros) {
    // El agujero pertenece al exterior más pequeño que lo contiene.
    const dueño = partes.filter((p) => h.slice(0, 3).every((v) => dentro(v, p[0]))).sort((a, b) => areaM2(a[0]) - areaM2(b[0]))[0];
    dueño?.push(h);
  }
  return partes;
}

const dist = (a: Caja, b: Caja) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]) * M_LON, Math.max(0, a[1] - b[3], b[1] - a[3]) * M_LAT);
const cajaDe = (p: Poligono): Caja => {
  const xs = p[0].map((q) => q[0]), ys = p[0].map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/**
 * Descarta islas pequeñas y lejanas: una parte se conserva si es mayor que `fraccion` de la mayor, o si queda a menos de
 * `lejos` m de otra parte ya conservada. Devuelve también lo descartado.
 */
export function quitarIslas(partes: Poligono[], fraccion = 0.1, lejos = 300) {
  const orden = [...partes].sort((a, b) => areaM2(b[0]) - areaM2(a[0]));
  const grande = orden.length ? areaM2(orden[0][0]) : 0;
  const quedan: Poligono[] = [], fuera: Poligono[] = [];
  for (const p of orden) {
    const ok = !quedan.length || areaM2(p[0]) >= fraccion * grande || quedan.some((q) => dist(cajaDe(p), cajaDe(q)) < lejos);
    (ok ? quedan : fuera).push(p);
  }
  return { quedan, fuera };
}

const simplificar = (partes: Poligono[], tolerancia: number): Poligono[] =>
  partes.flatMap((p) => {
    const [ext, ...ag] = p.map((a) => simplificarAnillo(a, tolerancia));
    return ext ? [[ext, ...ag.filter((a): a is Anillo => a !== null)]] : [];
  });

/** Geometrías unidas de las zonas definidas por barrios o distrito. `originales`: polígonos sin simplificar por id de barrio. */
export function construirZonas(
  defs: ZonaDef[], zonas: { id: string; barrioIds?: string[]; barrio?: number }[], originales: Map<string, Poligono[]>, tolerancia = 5,
) {
  const salida: ZonaUnida[] = [];
  const descartadas: Record<string, number> = {};
  for (const d of defs) {
    const z = zonas.find((x) => x.id === d.id);
    if (!z?.barrioIds?.length || d.caja || z.barrio !== undefined) continue; // Soho (caja) y alias de un solo barrio no se unen
    let partes = unir(z.barrioIds.flatMap((id) => originales.get(id) ?? []));
    if (d.distrito) {
      const r = quitarIslas(partes);
      partes = r.quedan;
      descartadas[d.id] = r.fuera.length;
    }
    const final = simplificar(partes, tolerancia);
    if (!final.length) continue;
    const cajas = final.map(cajaDe);
    const bbox: Caja = [Math.min(...cajas.map((c) => c[0])), Math.min(...cajas.map((c) => c[1])), Math.max(...cajas.map((c) => c[2])), Math.max(...cajas.map((c) => c[3]))];
    salida.push({ id: d.id, bbox, geometria: final.length === 1 ? { type: 'Polygon', coordinates: final[0] } : { type: 'MultiPolygon', coordinates: final } });
  }
  return { zonas: salida, descartadas };
}

if (import.meta.main) {
  const raiz = resolve(import.meta.dirname, '..');
  const leer = (f: string) => JSON.parse(readFileSync(resolve(raiz, f), 'utf8'));
  const geo = leer('pipeline/raw/barrios.geojson');
  const originales = new Map<string, Poligono[]>(geo.features.map((f: any) => {
    const polis = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return [String(f.properties.ID_BARRIO), polis.map((p: any[]) => p.map((r: any[]) => r.map((q) => [q[0], q[1]])))];
  }));
  const barrios = leer('src/data/barrios.json'), terrazas = leer('src/data/terrazas.json');
  const resueltas = resolverZonas(ZONAS, barrios, terrazas);
  const { zonas, descartadas } = construirZonas(ZONAS, resueltas, originales);
  writeFileSync(resolve(raiz, 'src/data/zonas.json'), JSON.stringify(zonas));
  // Locales de la zona (por distrito/barrios) que quedan fuera del contorno dibujado (islas descartadas o simplificación).
  const fuera = Object.fromEntries(zonas.map((u) => {
    const z = resueltas.find((x) => x.id === u.id)!;
    const ids = new Set(z.terrazas);
    return [u.id, terrazas.filter((t: any) => ids.has(t.id) && !dentroDeGeometria([t.lon, t.lat], u.geometria as Geometria)).length];
  }));
  console.log({ zonas: zonas.length, islasDescartadas: descartadas, localesFueraDelContorno: fuera });
}
