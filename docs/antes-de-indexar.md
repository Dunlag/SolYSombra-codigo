# Antes de indexar / hacer público de verdad

RECORDATORIO: quitar noindex y robots Disallow cuando los datos estén VALIDADOS en la calle (prueba de campo 2026-11-28).

- [ ] Prueba de campo hecha y modelo validado (ver `docs/validacion-campo.md`).
- [ ] Quitar `<meta name="robots" content="noindex, nofollow">` en `src/layouts/Base.astro`.
- [ ] Quitar `Disallow: /` de `public/robots.txt` (o sustituirlo por `Allow` + línea `Sitemap:`).
- [ ] Añadir sitemap (`@astrojs/sitemap`; `site` ya está en `astro.config.mjs`).
- [ ] Nombre y dominio definitivos; actualizar `site`/`base` (o `SS_BASE`) y el enlace de la demo en el README.
- [ ] Revisar atribuciones y licencias: Ayuntamiento de Málaga (terrazas), Catastro, OpenStreetMap/OpenFreeMap, fuentes `@fontsource` (OFL).
- [ ] Confirmar que no hay peticiones a terceros (`grep -r "googleapis" dist`, pestaña Red).
- [ ] Revisar textos de limitaciones/aviso de datos para que no prometan más de lo validado.

## Nota: robots.txt en GitHub Pages de proyecto
`robots.txt` NO tiene efecto en Pages de proyecto: se sirve en `/SolYSombra-codigo/robots.txt`, no en la raíz del dominio `dunlag.github.io`, y los rastreadores solo lo leen en la raíz. La barrera real es la meta `noindex` de `Base.astro`.
