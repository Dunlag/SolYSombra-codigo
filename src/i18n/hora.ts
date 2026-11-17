// Claves propias del selector de hora (no se toca es.ts/en.ts). Mismo tipo en los dos idiomas:
// si falta una clave en uno, TypeScript no compila.
export const es = {
  dia: 'Día',
};
export type TextosHora = typeof es;
export const en: TextosHora = {
  dia: 'Day',
};
