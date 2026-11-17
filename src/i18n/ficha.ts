// Claves solo de la ficha. No se tocan es.ts/en.ts (los edita otro flujo); aquí se reusan las
// existentes (alSolA, hastaLas, direccion, distrito, abrirEnMapas, diaCompleto) y se añaden las que faltan.
import type { Idioma } from './index';

const es = {
  estado: { sol: 'AL SOL', sombra: 'A LA SOMBRA', noche: 'DE NOCHE' },
  parentesis: {
    sombra: (h: string) => `(a la sombra, a las ${h})`,
    noche: (h: string) => `(de noche, a las ${h})`,
  },
  luego: { sol: 'luego al sol', sombra: 'luego a la sombra', noche: 'luego de noche' },
  sinCambios: 'sin cambios este día', // la fecha puede ser otro día: nada de "hoy"
  masDetalles: 'Más detalles',
  cerrar: 'Cerrar ficha',
  asa: (nivel: number) => `Cambiar altura de la ficha (ahora: ${['baja', 'media', 'completa'][nivel]})`,
  ficha: 'Ficha de terraza',
  eligeTerraza: 'Elige una terraza en el mapa',
  lineaDia: 'Día completo, hora a hora',
  leyenda: { sol: 'sol', sombra: 'sombra', noche: 'noche' },
};
export type TextosFicha = typeof es;
const en: TextosFicha = {
  estado: { sol: 'IN THE SUN', sombra: 'IN THE SHADE', noche: 'AT NIGHT' },
  parentesis: {
    sombra: (h) => `(in the shade, at ${h})`,
    noche: (h) => `(at night, at ${h})`,
  },
  luego: { sol: 'then sunny', sombra: 'then shaded', noche: 'then night' },
  sinCambios: 'no change this day',
  masDetalles: 'More details',
  cerrar: 'Close card',
  asa: (nivel) => `Change card height (now: ${['low', 'medium', 'full'][nivel]})`,
  ficha: 'Terrace card',
  eligeTerraza: 'Pick a terrace on the map',
  lineaDia: 'Full day, hour by hour',
  leyenda: { sol: 'sun', sombra: 'shade', noche: 'night' },
};
export const textosFicha = (i: Idioma): TextosFicha => (i === 'en' ? en : es);
