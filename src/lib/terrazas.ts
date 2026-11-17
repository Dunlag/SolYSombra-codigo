// Lógica pura (sin DOM, sin window): sirve igual en la web y en una futura app móvil.
import { estaAlSol, type Estado } from './sol.ts';

// Se duplica el tipo de pipeline/terraza.ts a propósito: el código de la web no debe
// importar del pipeline (que corre solo en Node al generar datos).
export type Terraza = {
  id: string; nombre: string; direccion: string; distrito: string;
  lat: number; lon: number; metros: number; horizonte: number[];
};

export type { Estado };

/** Estado de cada terraza en `fecha`, en el mismo orden que `terrazas`. */
export const estados = (terrazas: Terraza[], fecha: Date): Estado[] =>
  terrazas.map((t) => estaAlSol(t.horizonte, t.lat, t.lon, fecha));

export const contarAlSol = (terrazas: Terraza[], fecha: Date): number =>
  estados(terrazas, fecha).filter((e) => e === 'sol').length;

export type Coleccion = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { id: string; nombre: string; estado: Estado };
  }[];
};

/** GeoJSON para el mapa. Sin `horizonte`: son 180 números × 1665 terrazas y el mapa no los usa. */
export const aGeoJSON = (terrazas: Terraza[], est: Estado[]): Coleccion => ({
  type: 'FeatureCollection',
  features: terrazas.map((t, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [t.lon, t.lat] }, // GeoJSON: [lon, lat]
    properties: { id: t.id, nombre: t.nombre, estado: est[i] },
  })),
});
