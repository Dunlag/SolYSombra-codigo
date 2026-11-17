# Sol y Sombra

Mapa de terrazas de Málaga que indica, para una hora y día concretos, si cada terraza está al sol o a la sombra, y hasta cuándo. Resuelve la pregunta práctica de «¿dónde me siento ahora con sol (o sin él)?».

> **Prototipo — el modelo está en validación.** Los datos de sol/sombra no se han contrastado todavía en la calle (prueba de campo prevista el 2026-11-28). No los uses para decidir nada importante.

**Demo:** https://dunlag.github.io/SolYSombra-codigo/ (placeholder hasta activar GitHub Pages)

## Stack
Astro 7 + React (islas), TypeScript, MapLibre GL, SunCalc. Sitio estático. Un pipeline en Node (`pipeline/`) descarga datos municipales y del Catastro y precalcula las horas de sol por terraza.

## Arrancar
```sh
npm ci
npm run dev    # servidor de desarrollo
npm test       # tests (node --test)
npm run build  # genera dist/
npm run datos:descargar && npm run datos:barrios  # regenera src/data/barrios.json (barrios + terrazas de cada uno)
```
Requiere Node >= 22.23.4. Para servir bajo otra ruta base: `SS_BASE=/ruta npm run build`.

## Fuentes de datos
Ayuntamiento de Málaga (terrazas y barrios), Catastro (edificios y alturas), OpenStreetMap y OpenFreeMap (mapa base).

Consulta [licencias, procedencia y transformaciones de los datos](DATA_LICENSE.md): los JSON de terrazas y de barrios (límites simplificados) se distribuyen con el criterio conservador CC BY-SA 4.0 ante la discrepancia del catálogo municipal. Los originales catastrales no se redistribuyen.

## Licencia

Código bajo [licencia MIT](LICENSE). Los datos tienen su propia licencia: ver [DATA_LICENSE.md](DATA_LICENSE.md).
