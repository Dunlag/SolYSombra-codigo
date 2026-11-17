// Alias de barrios y zonas populares ("Soho", "Old Town", distritos...). Lógica pura (sin DOM).
// Una ZONA = unión de polígonos demarcados + ids de terrazas. Un alias que apunta a UN solo barrio real
// no crea zona: la búsqueda devuelve ese barrio (sin duplicar).
import type { Barrio } from './buscar.ts';
import type { Terraza } from './terrazas.ts';

type Geo = Barrio['geometria'];
export type Caja = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
export type ZonaDef = {
  id: string; nombre: string; nombreEn?: string; alias?: string[];
  barrios?: string[]; // nombres EXACTOS de src/data/barrios.json (los valida alias.test.ts)
  caja?: Caja; // zona informal sin barrio: rectángulo; sus locales son los puntos dentro
  distrito?: string; // distrito municipal 1-11 (el de las terrazas)
};

export const ZONAS: ZonaDef[] = [
  // APROXIMACIÓN INFORMAL: el Soho no es un barrio oficial. Caja ajustada a mano sobre las terrazas
  // (C/ Casas de Campos, Tomás Heredia, Alemania, Alameda Principal sur, Av. Manuel Agustín Heredia).
  { id: 'soho', nombre: 'Soho', nombreEn: 'Soho Arts District', alias: ['Distrito Soho', 'Barrio de las Artes', 'Arts District'], caja: [-4.4265, 36.712, -4.4195, 36.7175] },
  { id: 'casco', nombre: 'Centro histórico', alias: ['Centro', 'Casco antiguo', 'Casco histórico', 'Old Town', 'Historic centre', 'Historic center'], barrios: ['CENTRO HISTORICO'] },
  { id: 'humilladero', nombre: 'Cruz de Humilladero', alias: ['Cruz de Humilladero'], barrios: ['CRUZ DEL HUMILLADERO'] },
  { id: 'pedregalejo', nombre: 'Pedregalejo', alias: ['Pedregalejo'], barrios: ['PEDREGALEJO PLAYA'] }, // el barrio PEDREGALEJO no tiene locales
  { id: 'el-palo', nombre: 'El Palo (zona)', nombreEn: 'El Palo (area)', alias: ['El Palo'], barrios: ['EL PALO', 'ECHEVERRIA DEL PALO', 'PLAYAS DEL PALO', 'MIRAMAR DEL PALO'] },
  { id: 'perchel', nombre: 'El Perchel (zona)', nombreEn: 'El Perchel (area)', alias: ['Perchel', 'El Perchel'], barrios: ['PERCHEL SUR', 'PERCHEL NORTE'] },
  // Distritos: el dataset de barrios no trae el distrito. Locales = terrazas con ese distrito; contorno = los
  // barrios cuyo distrito MÁS FRECUENTE entre sus terrazas es ese (aproximado: un barrio a caballo se asigna a uno).
  { id: 'd1', nombre: 'Distrito Centro', nombreEn: 'Centro district', alias: ['Distrito 1'], distrito: '1' },
  { id: 'd2', nombre: 'Distrito Málaga Este', nombreEn: 'Málaga Este district', alias: ['Málaga Este', 'Este', 'East Málaga'], distrito: '2' },
  { id: 'd3', nombre: 'Distrito Ciudad Jardín', nombreEn: 'Ciudad Jardín district', distrito: '3' },
  { id: 'd4', nombre: 'Distrito Bailén-Miraflores', nombreEn: 'Bailén-Miraflores district', alias: ['Bailén', 'Bailen-Miraflores'], distrito: '4' },
  { id: 'd5', nombre: 'Distrito Palma-Palmilla', nombreEn: 'Palma-Palmilla district', alias: ['Palma-Palmilla', 'Palma Palmilla'], distrito: '5' },
  { id: 'd6', nombre: 'Distrito Cruz de Humilladero', nombreEn: 'Cruz de Humilladero district', distrito: '6' },
  { id: 'd7', nombre: 'Distrito Carretera de Cádiz', nombreEn: 'Carretera de Cádiz district', alias: ['Carretera de Cádiz', 'Carretera de Cadiz'], distrito: '7' },
  { id: 'd8', nombre: 'Distrito Churriana', nombreEn: 'Churriana district', distrito: '8' },
  { id: 'd9', nombre: 'Distrito Campanillas', nombreEn: 'Campanillas district', alias: ['Campanillas'], distrito: '9' },
  { id: 'd10', nombre: 'Distrito Puerto de la Torre', nombreEn: 'Puerto de la Torre district', alias: ['Puerto de la Torre'], distrito: '10' },
  { id: 'd11', nombre: 'Distrito Teatinos-Universidad', nombreEn: 'Teatinos-Universidad district', alias: ['Teatinos-Universidad', 'Universidad', 'University'], distrito: '11' },
];

export type Zona = {
  id: string; nombre: string; nombreEn: string; alias: string[];
  bbox: Caja; geometrias: Geo[]; terrazas: string[];
  /** Índice en `barrios` si la entrada apunta a un único barrio real: se busca como ese barrio. */
  barrio?: number;
  /** Ids de los barrios miembros (para que el pipeline una sus polígonos originales). */
  barrioIds?: string[];
};

/** Contorno ya unido de una zona (src/data/zonas.json, generado por pipeline/zonas.ts). */
export type ZonaUnida = { id: string; geometria: Geo; bbox: Caja };

export const nombreZona = (z: Pick<Zona, 'nombre' | 'nombreEn'>, idioma: string) => (idioma === 'en' ? z.nombreEn : z.nombre);

export const aZona = (b: Barrio): Zona => ({ id: `b-${b.id}`, nombre: b.nombre, nombreEn: b.nombre, alias: [], bbox: b.bbox, geometrias: [b.geometria], terrazas: b.terrazas });

const unir = (a: Caja, b: Caja): Caja => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/** Resuelve las definiciones contra los datos. Nombres de barrio desconocidos se ignoran (alias.test.ts los vigila); sin terrazas: se descarta. */
export function resolverZonas(defs: ZonaDef[], barrios: Barrio[], terrazas: Terraza[], unidas: ZonaUnida[] = []): Zona[] {
  const porNombre = new Map(barrios.map((b, i) => [b.nombre, i]));
  const distritoDe = new Map(terrazas.map((t) => [t.id, t.distrito]));
  // Distrito más frecuente de cada barrio.
  const distritoBarrio = barrios.map((b) => {
    const c = new Map<string, number>();
    b.terrazas.forEach((id) => c.set(distritoDe.get(id)!, (c.get(distritoDe.get(id)!) ?? 0) + 1));
    return [...c].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'en', { numeric: true }))[0]?.[0];
  });
  const zonas: Zona[] = [];
  for (const d of defs) {
    let idx: number[] = [], ids: string[] = [], geometrias: Geo[] = [], caja: Caja | null = null;
    if (d.caja) {
      const [x0, y0, x1, y1] = (caja = d.caja);
      ids = terrazas.filter((t) => t.lon >= x0 && t.lon <= x1 && t.lat >= y0 && t.lat <= y1).map((t) => t.id);
      geometrias = [{ type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] }];
    } else {
      idx = d.distrito ? barrios.flatMap((_, i) => (distritoBarrio[i] === d.distrito ? [i] : []))
        : (d.barrios ?? []).flatMap((n) => (porNombre.has(n) ? [porNombre.get(n)!] : []));
      ids = d.distrito ? terrazas.filter((t) => t.distrito === d.distrito).map((t) => t.id) : [...new Set(idx.flatMap((i) => barrios[i].terrazas))];
      geometrias = idx.map((i) => barrios[i].geometria);
      for (const i of idx) caja = caja ? unir(caja, barrios[i].bbox) : barrios[i].bbox;
      // Los locales del distrito que caen en un barrio asignado a otro distrito también deben quedar dentro del encuadre.
      if (d.distrito) for (const t of terrazas) if (t.distrito === d.distrito && caja) caja = unir(caja, [t.lon, t.lat, t.lon, t.lat]);
    }
    // Contorno único y bbox ya recortado (sin islas) de la zona; sin zonas.json se dibujan los barrios por separado.
    const u = unidas.find((x) => x.id === d.id);
    if (u) { geometrias = [u.geometria]; caja = u.bbox; }
    if (!ids.length || !caja) continue;
    zonas.push({
      id: d.id, nombre: d.nombre, nombreEn: d.nombreEn ?? d.nombre, alias: d.alias ?? [], bbox: caja, geometrias, terrazas: ids,
      barrio: d.barrios?.length === 1 && idx.length === 1 ? idx[0] : undefined,
      barrioIds: idx.map((i) => barrios[i].id),
    });
  }
  return zonas;
}
