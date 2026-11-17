import { convergencia, dentro, horizonte, puntoMuestreo, type Edificio, type Punto } from './geometria.ts';

export type Terraza = {
  id: string; nombre: string; direccion: string; distrito: string;
  lat: number; lon: number; metros: number; horizonte: number[];
};

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function aTerraza(f: any, cerca: (p: Punto) => Edificio[], separacion = 3): Terraza | 'sin-datos' | 'sin-punto' {
  const p = f.properties ?? {};
  // GeoJSON, CSV y KML municipales ya traen '?' (byte 0x3f): conservarlo,
  // porque ninguna recodificación permite deducir la letra perdida con fiabilidad.
  const nombre = String(p.nombre_lugar ?? '').trim();
  const [lon, lat] = f.geometry?.coordinates ?? [];
  // Number(null) y Number('') valen 0: un dato ausente no debe colarse como coordenada
  const num = (v: unknown) => (v == null || v === '' ? NaN : Number(v));
  const x = num(p.x), y = num(p.y);
  if (!nombre || ![lon, lat, x, y].every(Number.isFinite)) return 'sin-datos';

  const edificios = cerca([x, y]);
  const punto = puntoMuestreo([x, y], edificios, separacion);
  // El desplazamiento puede cruzar una celda del índice: consultar de nuevo incluye
  // todo obstáculo a 150 m del punto real; la unión con el origen no aporta rayos válidos.
  const edificiosMuestreo = cerca(punto);
  // si no se ha podido sacar a la calle, el horizonte saldría tapado en todas direcciones
  if (edificiosMuestreo.some((e) => dentro(punto, e.anillo))) return 'sin-punto';

  const calle = [p.direccion_actividad, p.numero].filter((v) => v != null && v !== '').join(' ');
  return {
    id: slug(`${nombre} ${calle}`),
    nombre,
    direccion: [p.via, calle].filter(Boolean).join(' '),
    distrito: String(p.distrito ?? ''),
    lat, lon,
    metros: Number(p.metros) || 0,
    horizonte: horizonte(punto, edificiosMuestreo, convergencia(lat, lon)),
  };
}
