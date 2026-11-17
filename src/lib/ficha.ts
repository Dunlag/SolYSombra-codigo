// Lógica pura de la ficha (sin DOM, sin window): testeable con node:test.
import { enMadrid } from './hora.ts';
import { estaAlSol, type Estado } from './sol.ts';
import type { Terraza } from './terrazas.ts';

// Alias, no copia: la ficha muestra la misma terraza que el mapa (import solo de tipo, sin ciclo en runtime).
export type DatosFicha = Terraza;

const PASO_MS = 5 * 60_000; // 5 min: el sol se mueve ~1,25° en ese rato, menos que 2 franjas

export type Tramo = { estado: Estado; hasta: Date | null; siguiente: Estado | null };

/** Estado en `fecha` y cuándo cambia (a resolución de 5 min). hasta=null si no cambia antes de medianoche de Madrid. */
export function tramoActual(t: DatosFicha, fecha: Date): Tramo {
  const estado = estaAlSol(t.horizonte, t.lat, t.lon, fecha);
  // Medianoche de MADRID (no la del dispositivo: un móvil en otra zona daría otro "fin de día"), y por
  // calendario, no sumando 24 h (días de cambio de hora).
  const fin = enMadrid(fecha, 1440).getTime();
  for (let ms = fecha.getTime() + PASO_MS; ms < fin; ms += PASO_MS) {
    const otro = estaAlSol(t.horizonte, t.lat, t.lon, new Date(ms));
    if (otro !== estado) return { estado, hasta: new Date(ms), siguiente: otro };
  }
  return { estado, hasta: null, siguiente: null };
}

/**
 * Estado de cada franja de 30 min del día de Madrid de `fecha` (48 valores), medido en el centro de la franja.
 * Cada franja se construye por hora de reloj de Madrid, así que los días de 23/25 h también salen bien.
 */
export function lineaDia(t: DatosFicha, fecha: Date): Estado[] {
  return Array.from({ length: 48 }, (_, i) =>
    estaAlSol(t.horizonte, t.lat, t.lon, enMadrid(fecha, i * 30 + 15)));
}

/**
 * Enlace universal de Google Maps (https): en Android abre la app de mapas y en iOS Google Maps si está
 * instalada (si no, el navegador). Se descarta geo: porque iOS y escritorio no lo entienden, y OSM
 * porque su web no abre ninguna app. Busca por nombre + dirección para que Google muestre la ficha del
 * local; si el texto trae '?' (tildes rotas en el origen municipal) la búsqueda fallaría y se usan las coordenadas.
 */
export function enlaceMapas(t: Pick<DatosFicha, 'nombre' | 'direccion' | 'lat' | 'lon'>): string {
  const texto = `${t.nombre}, ${t.direccion}, Málaga`;
  const query = texto.includes('?') ? `${t.lat},${t.lon}` : encodeURIComponent(texto);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export type Nivel = 0 | 1 | 2; // reposo, media, completa
export const siguienteNivel = (n: Nivel): Nivel => ((n + 1) % 3) as Nivel;

/** Imán: nivel cuya altura (px) está más cerca de la altura soltada. */
export function nivelMasCercano(alto: number, alturas: [number, number, number]): Nivel {
  let mejor: Nivel = 0;
  for (const n of [1, 2] as const) {
    if (Math.abs(alturas[n] - alto) < Math.abs(alturas[mejor] - alto)) mejor = n;
  }
  return mejor;
}
