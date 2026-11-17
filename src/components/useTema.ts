// Tema visual 'wave' (oscuro) | 'lotus' (claro). Un único sitio para App y Ficha.
// Orden de prioridad igual que tokens.css: data-theme forzado en <html> > prefers-color-scheme.
import { useEffect, useState } from 'react';
import type { Tema } from './Mapa';

const CLARO = '(prefers-color-scheme: light)';
const leerTema = (): Tema => {
  const forzado = document.documentElement.dataset.theme;
  return forzado ? (forzado === 'light' ? 'lotus' : 'wave') : matchMedia(CLARO).matches ? 'lotus' : 'wave';
};

export function useTema(): Tema {
  // Inicial perezoso: sin un primer render con 'wave' (que cargaría iconos oscuros de más). Seguro porque
  // la isla es client:only (siempre hay document).
  const [tema, setTema] = useState<Tema>(leerTema);
  useEffect(() => {
    const mq = matchMedia(CLARO);
    const leer = () => setTema(leerTema());
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  return tema;
}
