export type Punto = [number, number]; // [x este, y norte] en metros (EPSG:25830)
export type Edificio = { anillo: Punto[]; altura: number };

export const FRANJAS = 180;
export const RADIO = 150;

export function dentro(p: Punto, anillo: Punto[]): boolean {
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

// distancia desde p, en la dirección dir (unitaria), hasta el segmento ab; Infinity si no lo corta
function distRayo(p: Punto, dir: Punto, a: Punto, b: Punto): number {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = dir[0] * ey - dir[1] * ex;
  if (den === 0) return Infinity;
  const ax = a[0] - p[0], ay = a[1] - p[1];
  const t = (ax * ey - ay * ex) / den;
  const u = (ax * dir[1] - ay * dir[0]) / den;
  return t > 0 && u >= 0 && u <= 1 ? t : Infinity;
}

export function convergencia(lat: number, lon: number): number {
  // TM esférica (https://proj.org/en/stable/operations/projections/tmerc.html): gamma = atan(tan(lambda-lambda0) * sin(phi)), lambda0 = -3°.
  // Se usa la latitud geodésica: frente a TM elipsoidal GRS80 (EPSG:25830),
  // el error en Málaga es < 0,00001°, despreciable ante franjas de 2° y alturas enteras.
  // La corrección elipsoidal omitida empieza en O(e² * (lambda-lambda0)³).
  // Al oeste del meridiano central gamma < 0: norte de cuadrícula al oeste del verdadero.
  const rad = Math.PI / 180;
  return Math.atan(Math.tan((lon + 3) * rad) * Math.sin(lat * rad)) / rad;
}

export function horizonte(p: Punto, edificios: Edificio[], gamma = 0): number[] {
  const h = new Array<number>(FRANJAS).fill(0);
  for (let i = 0; i < FRANJAS; i++) {
    // Azimut verdadero = azimut de cuadrícula + gamma; rotamos el rayo,
    // conservando centros (i + 0,5) * 2° e índices desde el norte verdadero.
    const az = (((i + 0.5) * 360) / FRANJAS - gamma) * (Math.PI / 180);
    const dir: Punto = [Math.sin(az), Math.cos(az)];
    for (const e of edificios) {
      for (let k = 0; k < e.anillo.length; k++) {
        const d = distRayo(p, dir, e.anillo[k], e.anillo[(k + 1) % e.anillo.length]);
        if (d <= RADIO) h[i] = Math.max(h[i], Math.round(Math.atan2(e.altura, d) * (180 / Math.PI)));
      }
    }
  }
  return h;
}

function masCercano(p: Punto, a: Punto, b: Punto): Punto {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey || 1)));
  return [a[0] + t * ex, a[1] + t * ey];
}

// El punto municipal suele caer dentro del local o sobre la fachada: lo sacamos a la calle.
export function puntoMuestreo(p: Punto, edificios: Edificio[], separacion = 3): Punto {
  // Rechazar distancias inválidas evita muestrear dentro de la fachada por un error de configuración.
  if (!Number.isFinite(separacion) || separacion <= 0) throw new Error('La separación debe ser un número mayor que 0.');
  const libre = (q: Punto) => !edificios.some((e) => dentro(q, e.anillo));
  const estaDentro = !libre(p);
  const bordes: { d: number; q: Punto }[] = [];
  for (const e of edificios) {
    for (let k = 0; k < e.anillo.length; k++) {
      const q = masCercano(p, e.anillo[k], e.anillo[(k + 1) % e.anillo.length]);
      bordes.push({ d: Math.hypot(q[0] - p[0], q[1] - p[1]), q });
    }
  }
  bordes.sort((a, b) => a.d - b.d);
  if (!estaDentro && (bordes.length === 0 || bordes[0].d >= separacion)) return p;
  const s = estaDentro ? 1 : -1; // dentro: cruzar la fachada; fuera: alejarse de ella
  for (const { d, q } of bordes) {
    if (d === 0) continue;
    const r: Punto = [
      q[0] + ((q[0] - p[0]) / d) * s * separacion,
      q[1] + ((q[1] - p[1]) / d) * s * separacion,
    ];
    if (libre(r)) return r;
  }
  return p;
}

// Rejilla de 150 m: cada edificio se apunta en las celdas que toca su caja; se consultan las 3×3 vecinas.
export function crearIndice(edificios: Edificio[]): (p: Punto) => Edificio[] {
  const celdas = new Map<string, Edificio[]>();
  const c = (v: number) => Math.floor(v / RADIO);
  for (const e of edificios) {
    const xs = e.anillo.map((v) => v[0]), ys = e.anillo.map((v) => v[1]);
    for (let x = c(Math.min(...xs)); x <= c(Math.max(...xs)); x++) {
      for (let y = c(Math.min(...ys)); y <= c(Math.max(...ys)); y++) {
        const k = `${x},${y}`;
        if (!celdas.has(k)) celdas.set(k, []);
        celdas.get(k)!.push(e);
      }
    }
  }
  return (p) => {
    const vistos = new Set<Edificio>();
    for (let x = c(p[0]) - 1; x <= c(p[0]) + 1; x++) {
      for (let y = c(p[1]) - 1; y <= c(p[1]) + 1; y++) {
        for (const e of celdas.get(`${x},${y}`) ?? []) vistos.add(e);
      }
    }
    return [...vistos];
  };
}
