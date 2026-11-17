# Sol y Sombra — diseño del MVP (fases 0 y 1)

Fecha: 2026-10-03. Nombre de trabajo: **Sol y Sombra** (es lo único que se conserva del
planteamiento anterior). El nombre y el dominio se valoran por última vez justo antes de publicar;
hasta entonces no se compra nada. Al ser un término genérico, las palabras clave van en el
lema y en los títulos ("terrazas de Málaga al sol o a la sombra"), no en la marca.

## Objetivo

Web que muestra en un mapa las terrazas de bares y restaurantes de **Málaga** y dice si cada una
está al sol o a la sombra a la hora y fecha elegidas. Sombra en verano, sol en invierno.

Éxito del MVP: una persona en Málaga abre la web en el móvil, ve las terrazas cercanas coloreadas
por sol/sombra para "ahora", cambia la hora y acierta al llegar al sitio.

## Restricciones

- 0 €/mes (solo dominio). Sin backend ni base de datos.
- TypeScript de principio a fin.
- Ratos libres: cada pieza debe poder terminarse en una sesión corta.

## Aprendizaje y forma de trabajo

El proyecto es también un ejercicio de aprendizaje con dos objetivos:

- Entender cada fase (producto, SEO, marketing, lanzamiento): cada una empieza con una explicación
  de qué se hace y por qué.
- Aprender a trabajar con Claude de forma **totalmente autónoma**: Claude ejecuta el trabajo de
  principio a fin y Fernando solo supervisa y aprueba. En la práctica:
  - Claude decide por defecto y deja escrita la decisión; solo pregunta lo que únicamente Fernando
    puede responder.
  - Cada tarea termina con una comprobación que Claude ejecuta por sí mismo (test, script, URL).
  - Los puntos de aprobación son pocos y explícitos: spec, plan, validación de campo y todo lo que
    sea irreversible o salga al exterior (comprar dominio, publicar, contactar con medios).
  - Cuando algo requiera a Fernando (crear una cuenta, pagar, ir a una terraza), se le pide con
    pasos concretos.
  - Se explica qué configuración hace posible la autonomía (permisos, agentes, tareas programadas)
    a medida que se use.

## Fuentes de datos

| Dato | Fuente | Notas |
|---|---|---|
| Terrazas | Ayuntamiento de Málaga, "Ocupación en vía pública de mesas y sillas - Planos" (`da_ovpMesasPlanos-4326.geojson`), criterio conservador CC BY-SA 4.0 | La ficha indica CC BY 4.0, pero su enlace y API apuntan a CC BY-SA 4.0; véase [licencia de datos](../../../DATA_LICENSE.md). Geometría **punto**. Campos útiles: `nombre_lugar`, `via`, `direccion_actividad`, `numero`, `distrito`, `metros`, `plano` (PDF). Los planos enlazados son de 2026-03. |
| Edificios | Catastro INSPIRE Buildings (ATOM, municipio de Málaga), GML en EPSG:25830 | Huella por parte de edificio y `numberOfFloorsAboveGround`. |
| Posición del sol | Librería `suncalc` | Cálculo en el navegador. |

Solo aparecen terrazas en vía pública con licencia municipal. Las terrazas en suelo privado
(patios, azoteas) quedan fuera de la v1.

## Arquitectura

```
datos municipales + Catastro
        │  (scripts locales, se ejecutan a mano)
        ▼
  terrazas.json  ──►  sitio Astro estático  ──►  Cloudflare Pages
                        └ isla React: mapa MapLibre + suncalc
```

### 1. Pipeline de datos (`pipeline/`)

Scripts Node/TS ejecutados en local; su salida se guarda en el repo.

1. `descargar`: baja el GeoJSON de terrazas y el GML de edificios a `pipeline/raw/` (no versionado).
2. `edificios`: convierte el GML a una lista de polígonos con altura = `plantas × 3 m`, en
   coordenadas métricas (EPSG:25830) para medir distancias sin conversiones.
3. `horizonte`: para cada terraza calcula su **perfil de horizonte**: 180 valores (uno cada 2° de
   azimut) con el mayor ángulo de elevación `atan(altura / distancia)` de los edificios que cruza
   un rayo de 150 m en esa dirección. Índice espacial para no comparar con todos los edificios.
4. `exportar`: escribe `src/data/terrazas.json` con `id`, `nombre`, `direccion`, `distrito`,
   `lat`, `lon`, `metros` y `horizonte` (grados enteros).

Punto de muestreo: el punto municipal suele caer sobre la fachada o dentro del edificio del local.
Se desplaza unos metros hacia fuera del edificio que lo contiene, en perpendicular a la fachada
más cercana. El spike de la fase 0 decide si esto basta o hay que usar el plano PDF.

### 2. Función sol/sombra (`src/lib/sol.ts`)

`estaAlSol(horizonte, lat, lon, fecha): 'sol' | 'sombra' | 'noche'`

- `noche` si la altura del sol es ≤ 0.
- `sol` si la altura del sol supera `horizonte[azimut]`; si no, `sombra`.

Función pura, la usan el mapa y la generación de páginas. Tiene tests, al igual que el pipeline y otras funciones de la aplicación.

### 3. Web (`src/`)

- **Astro** genera HTML estático. Una isla React contiene el mapa.
- **Mapa:** MapLibre GL con teselas de OpenFreeMap (sin clave ni coste). Un marcador por terraza,
  color según `estaAlSol`. Selector de hora y fecha; botón "ahora"; botón de geolocalización.
- **Ficha:** al pulsar un marcador: nombre, dirección, estado actual, hasta qué hora sigue así y
  enlace para abrir la ubicación en la app de mapas del móvil.
- **PWA:** manifiesto e icono para poder instalarla. Sin modo offline en la v1.
- Aviso visible de limitaciones y atribuciones (Ayuntamiento de Málaga, Catastro, OpenStreetMap).

Las páginas por terraza y por barrio se diseñan en la fase 2 (SEO), sobre este mismo JSON.

## Limitaciones conocidas de la v1

- No se modelan toldos, sombrillas, árboles ni relieve.
- La altura de los edificios es una estimación por número de plantas.
- La posición de la terraza es aproximada (un punto, no su contorno).

## Errores y casos límite

- Terraza sin edificios cerca: horizonte todo a 0, siempre al sol de día.
- Registro sin nombre o sin coordenadas: se descarta en `exportar` y se cuenta en el log.
- Geolocalización denegada: el mapa se queda centrado en el centro de Málaga.

## Pruebas

- Test de `estaAlSol`: de noche; horizonte despejado a mediodía; horizonte tapado en la dirección
  del sol; mismo horizonte con sol de invierno y de verano.
- **Validación de campo (previa a la publicación general):** 5 terrazas conocidas, comparadas en persona a una
  hora concreta. Con más de 1 fallo de 5 se revisa el modelo antes de publicar para uso general.
  El prototipo web avanza en paralelo, identificado como modelo sin validar.

## Fase 0: orden de trabajo

1. Spike de datos: descargar, inspeccionar, calcular el horizonte de 5 terrazas y validarlas.
2. Dominio para el nombre Sol y Sombra (comprobado el 2026-10-03: `solysombra.es`, `.com`, `.net`
   y `.org` están ocupados; libres `solysombra.app`, `solysombramalaga.es` y `solysombramalaga.com`).

## Fuera de alcance

Cuentas de usuario, aportaciones de usuarios, capa visual de sombras, reseñas, otras ciudades,
monetización, app nativa.
