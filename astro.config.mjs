// Configuración de Astro. Astro genera HTML estático por defecto (sin servidor),
// que encaja con el presupuesto de 0 EUR/mes: se puede alojar en cualquier hosting gratuito.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  // GitHub Pages sirve el repo en https://dunlag.github.io/SolYSombra-codigo/
  site: 'https://dunlag.github.io',
  base: process.env.SS_BASE ?? '/SolYSombra-codigo',
  // CSP con hashes de los scripts/estilos inline que emite Astro (meta http-equiv generada en el build).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https://tiles.openfreemap.org",
        "connect-src 'self' https://tiles.openfreemap.org",
        "worker-src 'self' blob:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
    },
  },
  // La integración de React permite escribir "islas" interactivas en .tsx.
  integrations: [react()],
});
