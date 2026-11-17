// Único breakpoint de escritorio. App.css repite este valor en su @media (CSS no admite variables ahí): cambiar ambos a la vez.
import { useEffect, useState } from 'react';

const ESCRITORIO = '(min-width: 1024px)';

export function useEscritorio(): boolean {
  // Inicial perezoso: la isla es client:only, siempre hay window.
  const [v, setV] = useState(() => matchMedia(ESCRITORIO).matches);
  useEffect(() => {
    const mq = matchMedia(ESCRITORIO);
    const leer = () => setV(mq.matches);
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  return v;
}
