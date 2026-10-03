import { createReadStream } from 'node:fs';
import type { Edificio, Punto } from './geometria.ts';

export const SEPARADOR = '<bu-ext2d:BuildingPart ';
const METROS_POR_PLANTA = 3;

// ponytail: lectura por expresiones regulares, atada al formato GML actual del Catastro;
// pasar a un parser XML si el formato cambia. Solo anillo exterior: los patios se ignoran.
export function parsearParte(trozo: string): Edificio | null {
  const plantas = Number(/numberOfFloorsAboveGround>(\d+)</.exec(trozo)?.[1] ?? 0);
  const pos = /<gml:posList[^>]*>([^<]+)</.exec(trozo)?.[1];
  if (!plantas || !pos) return null;
  const n = pos.trim().split(/\s+/).map(Number);
  const anillo: Punto[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) anillo.push([n[i], n[i + 1]]);
  return { anillo, altura: plantas * METROS_POR_PLANTA };
}

// El fichero pesa cientos de MB: se lee en streaming y se corta por elemento.
export async function leerEdificios(ruta: string): Promise<Edificio[]> {
  const edificios: Edificio[] = [];
  let resto = '';
  for await (const trozo of createReadStream(ruta, 'utf8')) {
    const partes = (resto + trozo).split(SEPARADOR);
    resto = partes.pop()!;
    for (const p of partes) {
      const e = parsearParte(p);
      if (e) edificios.push(e);
    }
  }
  const ultimo = parsearParte(resto);
  if (ultimo) edificios.push(ultimo);
  return edificios;
}
