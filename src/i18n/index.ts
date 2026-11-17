// Helper puro (sin DOM): sirve igual en la web y en una futura app móvil.
import { es, type Textos } from './es';
import { en } from './en';

export type Idioma = 'es' | 'en';
export const IDIOMAS: Idioma[] = ['es', 'en'];
const tablas: Record<Idioma, Textos> = { es, en };

/** Devuelve el diccionario de un idioma. Uso: const t = useT('es'); t.ahora */
export const useT = (idioma: Idioma): Textos => tablas[idioma];

/** Idioma inicial a partir de navigator.language (se pasa el string: sin tocar el DOM). */
export const idiomaDe = (lang: string | undefined): Idioma =>
  lang?.toLowerCase().startsWith('en') ? 'en' : 'es';

export type { Textos };
