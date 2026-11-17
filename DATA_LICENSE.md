# Licencias y procedencia de los datos

Este documento cubre los datos y sus atribuciones; no establece la licencia del código del proyecto.

## Ayuntamiento de Málaga: terrazas

Fuente: Ayuntamiento de Málaga, «Ocupación en vía pública de mesas y sillas - Planos»,
[recurso GeoJSON EPSG 4326](https://datosabiertos.malaga.eu/dataset/ocupacion-en-via-publica-de-mesas-y-sillas-planos/resource/0195c7e9-537a-4d01-96f5-18e23924a309).

La copia local de `pipeline/raw/terrazas.geojson` tiene fecha de modificación **2026-10-03
13:37:20 +02:00**. Se toma como fecha de descarga de referencia; el mtime no es un registro
independiente que permita certificar cuándo se obtuvo el contenido ni su fecha de actualización.

### Discrepancia de licencia y criterio adoptado

Comprobación del 17-11-2026: la ficha muestra **CC BY 4.0**, pero su enlace conduce a
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
La [API oficial del catálogo](https://datosabiertos.malaga.eu/api/3/action/package_show?id=ocupacion-en-via-publica-de-mesas-y-sillas-planos)
también devuelve `license_id: by-sa-40` y `license_url` de CC BY-SA 4.0, aunque
`license_title` dice CC BY 4.0. La discrepancia sigue pendiente de aclaración del proveedor.

Hasta que se aclare, este proyecto adopta el criterio conservador de distribuir
**`src/data/terrazas.json` como adaptación de los datos municipales bajo CC BY-SA 4.0**:
se debe conservar el crédito al Ayuntamiento, enlazar la fuente y la licencia, indicar los
cambios y compartir las adaptaciones bajo la misma licencia o una compatible. No se sugiere
respaldo del Ayuntamiento al proyecto. Las condiciones de la fuente catastral se identifican
por separado a continuación.

Transformaciones efectuadas por Sol y Sombra:

- Selección de nombre, dirección, distrito, coordenadas y superficie; omisión de campos de
  presentación, enlaces a planos y otros campos ajenos al cálculo.
- Normalización de nombres/direcciones e identificadores, validación y filtrado de registros
  sin datos utilizables, y resolución de identificadores duplicados.
- Estimación de alturas de edificios por plantas, selección de un punto de muestreo próximo
  al local y cálculo del perfil de horizonte: 180 ángulos de elevación en pasos de 2° a partir
  de obstáculos catastrales próximos. No es una medición de campo de la terraza.

## Ayuntamiento de Málaga: barrios

Fuente: Ayuntamiento de Málaga, «Sistema de Información Cartográfica - Barrio»
([ficha](https://datosabiertos.malaga.eu/dataset/sistema-de-informacion-cartografica-barrio),
[recurso GeoJSON EPSG 4326](https://datosabiertos.malaga.eu/recursos/urbanismoEInfraestructura/planimetria/callejero/da_cartografiaBarrio-4326.geojson)).
Copia local: `pipeline/raw/barrios.geojson` (ignorado por Git, no se redistribuye), descargada el **2026-11-17**
(mtime 10:23 +01:00; mismo aviso que arriba sobre el mtime).

Misma contradicción de licencia, comprobada el 17-11-2026: la ficha y `license_title` de la
[API del catálogo](https://datosabiertos.malaga.eu/api/3/action/package_show?id=sistema-de-informacion-cartografica-barrio)
dicen **CC BY 4.0**, pero `license_id` es `by-sa-40` y `license_url` apunta a
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Se aplica el mismo criterio conservador:
**`src/data/barrios.json` se distribuye como adaptación bajo CC BY-SA 4.0**, con crédito al Ayuntamiento,
enlace a la fuente y a la licencia, indicación de los cambios y sin sugerir respaldo municipal.

Transformaciones efectuadas por Sol y Sombra (`pipeline/barrios.ts`):

- Selección de identificador (`ID_BARRIO`) y nombre (`NOMBARRIO`, sin los espacios de relleno); omisión de código y nombre «común».
- Eliminación de la tercera coordenada (cota) y simplificación de los polígonos (Douglas-Peucker, tolerancia 5 m;
  coordenadas a 5 decimales ≈ 1 m). **Los límites resultantes son aproximados, no cartografía oficial.**
- Asignación de cada terraza a su barrio por punto en polígono sobre la geometría original, y lista de identificadores de terrazas por barrio.
- Se descartan los barrios sin ninguna terraza (173 de 419 se conservan).

## Dirección General del Catastro: edificios INSPIRE

Fuente: Dirección General del Catastro, conjunto INSPIRE Buildings del municipio de Málaga
(29900), [servicios y descargas INSPIRE](https://www.catastro.hacienda.gob.es/webinspire/).
Rige la [licencia de acceso y uso de servicios y conjuntos INSPIRE, versión julio de 2016](https://www.catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf).

El proyecto usa esta información para producir perfiles de horizonte transformados, sin
redistribuir las huellas originales. La licencia permite productos transformados de valor
añadido y no autoriza distribuir los originales sin transformación. Los ZIP/GML descargados
permanecen en `pipeline/raw/`, ignorado por Git, y **no se redistribuyen**.

El resultado es un producto transformado de Sol y Sombra, **no cartografía catastral oficial**
ni información fehaciente sobre inmuebles. Puede contener errores o datos desactualizados;
Catastro no responde de los resultados del modelo. Las alturas y posiciones son aproximadas.

## Mapa base: OpenFreeMap, OpenMapTiles y OpenStreetMap

El mapa usa teselas servidas por [OpenFreeMap](https://openfreemap.org/) y su estilo Positron,
con [OpenMapTiles](https://www.openmaptiles.org/) y datos de
[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Los datos de OpenStreetMap se ofrecen bajo
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

Se debe conservar la atribución visible y enlazada que proporciona el mapa: OpenFreeMap,
© OpenMapTiles y datos de OpenStreetMap. Véase la
[guía de atribución e integración de OpenFreeMap](https://openfreemap.org/quick_start/).
La licencia del software de OpenFreeMap no sustituye a la licencia ODbL de los datos del mapa.

El pipeline de terrazas no extrae datos de OpenStreetMap: los muestra sobre el mapa base.
Este repositorio no redistribuye teselas ni una copia de la base de datos de OpenStreetMap.
Una futura redistribución o adaptación de esos materiales requeriría cumplir sus condiciones
propias, incluida ODbL cuando corresponda.
