// Lógica pura del selector de hora (sin DOM, sin window).
// PORQUÉ Madrid explícito: el usuario puede tener el móvil en otra zona horaria, pero las terrazas
// están en Málaga (Europe/Madrid). Toda "hora del día" se lee y se construye en esa zona, nunca con
// getHours() del dispositivo.

export const ZONA = 'Europe/Madrid';
export const PASO = 5;          // minutos
export const MIN = 8 * 60;      // 08:00
export const MAX = 22 * 60;     // 22:00
export const MIN_TARDE = 17 * 60;

export type Idioma = 'es' | 'en';

// Un DateTimeFormat por llamada sería caro (se invoca en cada frame al arrastrar): se crea una vez.
const fmtPartes = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

type Partes = { y: number; m: number; d: number; min: number; seg: number };

/** Año, mes (1-12), día y minutos desde las 00:00, todo en hora de Madrid. */
const partes = (f: Date): Partes => {
  const p: Record<string, number> = {};
  for (const x of fmtPartes.formatToParts(f)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, min: p.hour * 60 + p.minute, seg: p.second };
};

/** Diferencia (ms) entre Madrid y UTC en el instante `ms`: 3.600.000 en invierno, 7.200.000 en verano. */
const desfase = (ms: number): number => {
  const p = partes(new Date(ms));
  return Date.UTC(p.y, p.m - 1, p.d, 0, p.min, p.seg) - Math.floor(ms / 1000) * 1000;
};

/** Instante en que en Madrid son y-m-d a `min` minutos. Dos pasadas: el desfase se mide en el instante resultante. */
const construir = (y: number, m: number, d: number, min: number): Date => {
  const naif = Date.UTC(y, m - 1, d, 0, min);
  let ms = naif - desfase(naif);
  ms = naif - desfase(ms); // corrige si el primer intento cayó al otro lado de un cambio de hora
  return new Date(ms);
};

/** Redondea al paso y limita al rango 08:00-22:00. */
export const ajustarMinutos = (min: number): number =>
  Math.min(MAX, Math.max(MIN, Math.round(min / PASO) * PASO));

/** Minutos desde las 00:00 de Madrid (entero, sin segundos). */
export const minutosDelDia = (f: Date): number => partes(f).min;

/** Fecha en el mismo DÍA de Madrid que `base`, a `minutos` (ajustados al paso y al rango). */
export const aFecha = (base: Date, minutos: number): Date => {
  const p = partes(base);
  return construir(p.y, p.m, p.d, ajustarMinutos(minutos));
};

/**
 * Instante a `min` minutos (0-1440) del día de Madrid de `base`, SIN limitar al rango 08:00-22:00.
 * min=0 → inicio del día; min=1440 → inicio del día siguiente (correcto también en días de 23/25 h).
 */
export const enMadrid = (base: Date, min: number): Date => {
  const p = partes(base);
  return construir(p.y, p.m, p.d, min);
};

/** Clamp + redondeo de una Date cualquiera al paso (los segundos cuentan para redondear bien). */
export const ajustar = (f: Date): Date => {
  const p = partes(f);
  return aFecha(f, p.min + p.seg / 60);
};

/** "HH:MM" en hora de Madrid. */
export const textoHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** "YYYY-MM-DD" del día de Madrid: es el formato que exige <input type="date">. */
export const aISO = (f: Date): string => {
  const p = partes(f);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

/** Cambia solo el día (ISO) conservando la hora seleccionada. null si el ISO no es válido. */
export const conDiaISO = (f: Date, iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return construir(+m[1], +m[2], +m[3], ajustarMinutos(minutosDelDia(f)));
};

// ---- Chips ----
// `reloj` se inyecta para poder testear con una fecha fija.

/** Chip "Ahora": la hora real redondeada y limitada al rango (de noche queda en 08:00 o 22:00). */
export const ahora = (reloj: Date = new Date()): Date => ajustar(reloj);

/** Chip "+1 h": una hora más, con tope en 22:00. */
export const masUnaHora = (f: Date): Date => aFecha(f, minutosDelDia(f) + 60);

/** Chip "Tarde": las 17:00 del mismo día. */
export const tarde = (f: Date): Date => aFecha(f, MIN_TARDE);

/**
 * Chip "Mañana": la MISMA hora del día siguiente (así comparas "¿y mañana a esta hora?").
 * Decisión: no se fija a una hora concreta (el diseño usaba 12:00 solo porque el prototipo era estático).
 * Se calcula sumando 1 al día del calendario de Madrid, no +24 h: el día del cambio de hora dura 23/25 h.
 */
export const manana = (f: Date): Date => {
  const p = partes(f);
  const sig = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  return construir(sig.getUTCFullYear(), sig.getUTCMonth() + 1, sig.getUTCDate(), ajustarMinutos(p.min));
};

// ---- Etiquetas ----

export type Relativa = 'ahora' | 'hoy' | 'manana' | null;

/** Nº de día de calendario de Madrid (comparable por resta, sin líos de horas). */
const numDia = (f: Date): number => {
  const p = partes(f);
  return Date.UTC(p.y, p.m - 1, p.d) / 86_400_000;
};

/** ahora = mismo día y misma hora redondeada que el reloj; null si es otro día lejano (solo se muestra la fecha). */
export const relativa = (f: Date, reloj: Date = new Date()): Relativa => {
  const dif = numDia(f) - numDia(reloj);
  if (dif === 0) return minutosDelDia(f) === minutosDelDia(ahora(reloj)) ? 'ahora' : 'hoy';
  return dif === 1 ? 'manana' : null;
};

/** "lun 16 nov" / "Mon 16 Nov", en hora de Madrid. Sin comas ni puntos: es una etiqueta corta, no una frase. */
export const etiquetaFecha = (f: Date, idioma: Idioma): string =>
  new Intl.DateTimeFormat(idioma === 'en' ? 'en-GB' : 'es-ES', {
    timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short',
  }).format(f).replace(/[,.]/g, '');

// ---- Histograma ----

/** Conteos → 0..1 dividiendo por el máximo. Todo ceros (o vacío) → ceros, sin NaN. */
export const normalizarHistograma = (conteos: number[]): number[] => {
  const max = Math.max(0, ...conteos);
  return conteos.map((c) => (max > 0 ? Math.max(0, c) / max : 0));
};
