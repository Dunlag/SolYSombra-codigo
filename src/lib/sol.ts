import { getPosition } from 'suncalc';
import { enEclipse } from './eclipse.ts';

export type Estado = 'sol' | 'sombra' | 'noche';
export const GRADOS_POR_FRANJA = 2;

export function estaAlSol(horizonte: number[], lat: number, lon: number, fecha: Date): Estado {
  // suncalc 2.x: grados; azimut desde el norte en sentido horario
  const { azimuth, altitude } = getPosition(fecha, lat, lon);
  if (altitude <= 0) return 'noche';
  if (enEclipse(fecha) === 'total') return 'sombra'; // easter egg: la Luna manda más que cualquier horizonte
  const franja = Math.floor(azimuth / GRADOS_POR_FRANJA) % horizonte.length;
  return altitude > horizonte[franja] ? 'sol' : 'sombra';
}
