# Decisiones de diseño v2 (Kanagawa)

Fecha de este registro: 2026-11-16. Fuentes: `docs/diseno/brief-claude-design.md` (2026-11-13),
`docs/superpowers/specs/2026-10-03-solysombra-mvp-design.md` y las copias del lienzo en
`scratchpad/.../project/` (`canvas.json`, `V2-Sistema.dc.html`, `V2-A`…`V2-E`, `assets/tokens.css`).

Cada cifra indica su origen. Lo que no aparece en esas fuentes va en la sección
[Pendiente de verificar](#pendiente-de-verificar).

## 1. Dirección elegida: V2 Kanagawa

- El lienzo (`canvas.json`) abre en la página `v2` (`launch.page: "v2"`) y su título es
  «Sol y Sombra · prototipo móvil». Es la señal de que V2 es la dirección elegida. El texto de la
  decisión no está escrito en los archivos leídos: confirmar con Fernando antes de darla por cerrada.
- V2 usa la paleta de los temas Kanagawa de Neovim/Hyprland (nombres `sumiInk`, `carpYellow`,
  `crystalBlue`, `oniViolet`, `roninYellow`, `fujiWhite`, según `canvas.json` y `V2-Sistema`).
- Tema claro (Lotus) para pleno sol; tema oscuro (Wave) como base. El tema sigue al sistema
  (`canvas.json`, nota `v2n1`).

### Por qué se descarta V1 «papel y tinta»

El brief (sección 5) la propone como dirección: papel `#f2f1ed`, tinta `#0a0a0a`, Anton e IBM Plex
Mono, sombra dura y sin blur. El lienzo la conserva como página `v1` («Papel y tinta (v1)»), pero
ya no es la dirección de lanzamiento.

El motivo del descarte **no está escrito** en los archivos leídos. Se deduce solo del orden de
páginas y del lanzamiento en `v2`. Hay que confirmarlo con Fernando.

Diferencias concretas que sí se ven en los archivos:

| Aspecto | V1 papel y tinta (`assets/tokens.css`) | V2 Kanagawa (`V2-Sistema`) |
|---|---|---|
| Fondo | papel `#f2f1ed` (tema oscuro `#0b0b0d`) | `sumiInk0` `#16161D` / `sumiInk1` `#1F1F28` |
| Sol | `#ffe81a` con contorno de tinta | `carpYellow` `#E6C384` |
| Sombra | `#1f3de0` | `crystalBlue` `#7E9CD8` |
| Noche | tinta `#0a0a0a` | `oniViolet` `#957FB8` |
| Títulos | Anton | Archivo (ancho 62 %, peso 900) |
| Etiquetas | IBM Plex Mono | Instrument Serif itálica y JetBrains Mono |

## 2. Paleta

### Kanagawa Wave (oscuro)

Hex y roles tomados de las etiquetas de `V2-Sistema.dc.html`:

| Token | Hex | Uso según el sistema |
|---|---|---|
| sumiInk0 | `#16161D` | huecos entre tiles |
| sumiInk1 | `#1F1F28` | tiles y mapa |
| sumiInk3 | `#363646` | bordes de tile |
| fujiWhite | `#DCD7BA` | texto y botón principal (el sistema indica 11:1) |
| carpYellow | `#E6C384` | sol: ficha y marcador |
| crystalBlue | `#7E9CD8` | sombra: ficha y marcador |
| oniViolet | `#957FB8` | noche: marcador |
| roninYellow | `#FF9E3B` | tile activo y anillo de foco |

Otros hex que aparecen en las pantallas sin etiqueta de rol en el sistema: `#C8C093`, `#54546D`,
`#2B3328`, `#223249`, `#2A2A37`. Sin rol confirmado.

### Kanagawa Lotus (claro, pantalla D)

`V2-D-lotus-en.dc.html` no tiene una tabla de tokens Lotus. Los roles siguientes son **inferidos
del uso en el archivo**:

| Hex | Uso observado |
|---|---|
| `#f2ecbc` | fondo de cabecera y secciones |
| `#1F1F28` | texto y tinta |
| `#de9800` | sol: cifras y marcador (es el hex más usado del archivo) |
| `#545464` | texto secundario |
| `#4d699b` | sombra: marcador de la pantalla D (el SVG `assets/kanagawa/lotus-sol-24.svg` existe, sin leer) |
| `#FF9E3B` | foco |
| `#43436c` | texto sobre el mapa |
| `#e5ddb0`, `#d5dcb0`, `#c7d7e0` | capas del mapa de la ilustración (sin rol confirmado) |

## 3. Tipografías

Según `V2-Sistema.dc.html`, `V2-A-mapa.dc.html` y las demás pantallas V2:

- **Archivo** (Google Fonts, ejes `wdth 62–125`, `wght 400–900`): hora grande, títulos y nombre de
  terraza. La hora usa ancho 62 % y peso 900.
- **Instrument Serif** itálica: etiquetas de tono editorial, por ejemplo «(ahora) lun 16 nov».
- **JetBrains Mono**: etiquetas en mayúsculas y datos cortos.
- **IBM Plex Sans**: aparece en 7 pantallas V2 como fuente de cuerpo. El sistema no la menciona;
  queda sin confirmar si es la definitiva.
- Tamaños observados en las pantallas V2: 11, 12, 13, 15, 16, 19, 25, 26, 44 y 84 px, sin escala
  declarada. La hora usa 84 px en `V2-A` y en `V2-C`. Ver [pendientes](#pendiente-de-verificar).
- V1 (`assets/tokens.css`) define una escala propia: etiquetas 12 px, texto 16 px, nombre 22 px,
  hora 28 px, techo 48 px. V2 no tiene tokens de escala exportados.

## 4. Estados: sol, sombra y noche

Regla del brief: forma + color + palabra. Nunca solo color (WCAG 1.4.1).

| Estado | Forma (V2) | Color Wave | Color Lotus | Texto |
|---|---|---|---|---|
| Sol | círculo con 8 rayos (`V2-Sistema`) | `#E6C384` | `#de9800` | «Sol» + hora hasta la que dura |
| Sombra | cuadrado rayado; se lee a 24 px (`canvas` nota `v2n4`) | `#7E9CD8` | `#4d699b` | «Sombra» + motivo (el edificio que tapa) |
| Noche | rombo con luna (`V2-Sistema`) | `#957FB8` | sin confirmar | «Noche» |

Cambios frente al brief (sección 5 y tabla de estados):

- El brief proponía círculo amarillo `#ffe81a` con contorno de tinta, cuadrado azul y rombo tinta.
  V2 cambia los tres colores a la paleta Kanagawa.
- De noche, todos los marcadores pasan a rombo (`canvas` nota `nF`).
- La ficha explica la sombra con el edificio que tapa el sol (`v2n4`).

## 5. Pantallas

Las notas vienen de `canvas.json`. Las notas `nA`–`nH` son de la versión V1. Las notas
`v2n1`–`v2n4` son de V2.

### Pantalla A: mapa y hora (V2-A-mapa)

- Panel inferior en reposo, de 180–220 px (`nA`, nota de la versión V1; la pantalla V2-A no está descrita nota a nota).
- Sin terraza elegida, el panel muestra el contador. Al tocar un marcador pasa a la ficha (B).
- Tocar el asa o «Ver lista» abre «Cerca de mí», que en V2 no tiene pantalla propia.
- `V2-A-mapa` usa 84 px en un elemento de la hora; su posición exacta no está confirmada.

### Pantalla B: ficha (V2-B-ficha-sol y V2-B-ficha-sombra)

- Tres alturas en V1 (`nB`): reposo 220 px, media ~64 % (`64dvh` en `tokens.css`) y completa
  (pantalla menos 44 px). Arrastre con imán a la altura más cercana.
- Alternativa sin arrastre (WCAG 2.5.7): tocar el asa o los botones «Más detalles» y
  «Ver el día completo». Esc o la X cierran.
- Decisión 2 (`nB3`, propuesta): la línea horaria del día completa solo se muestra a altura completa.
  En reposo y media basta con «hasta las 15:20».
- Decisión 3 (`nB3`, propuesta): tres estados, sin «sol parcial». El texto «Después, a la sombra…»
  cubre la transición.

### Pantalla C: hora con histograma (V2-C-hora, interactivo)

- Slider de 8:00 a 22:00 con paso de 5 min. El mapa se recalcula en vivo mientras se arrastra
  (`nC`).
- Flechas = ±5 min. RePág/AvPág = ±1 h.
- Chips: «Ahora» (hora real), «+1 h» y «Tarde» (17:00). En V2 aparece también «Mañana»
  (`v2n2`).
- La fecha abre un selector nativo (`nC`).
- Arrastrar sobre el histograma o usar las flechas. Una superficie de 44 × 72 px cubre el control
  (`input[type=range].hist` en `V2-C`).
- La hora usa 84 px. Por encima del techo de 48 px del brief: es intencionado (`v2n2`).

### Pantalla D: Lotus claro en inglés (V2-D-lotus-en)

- Tema claro para pleno sol.
- Es la única pantalla V2 en inglés.

### Pantalla E: escritorio 1440 (V2-E-escritorio) y boceto «Escritorio» (V1)

- Tiles estilo Hyprland: hora, resumen y «cerca de ti» a la izquierda; mapa en el centro con grupos
  a bajo zoom; ficha a la derecha (`v2n3`).
- Por debajo de ~1100 px las columnas bajan y el mapa queda arriba (`v2n3`).

### Pantalla F: nublado (V2-F-nublado, fase 2)

- Un aviso para toda la ciudad, no un icono por terraza. Los soles se atenúan (`v2n4`).
- Necesita una API del tiempo: AEMET u Open-Meteo (`v2n4`). Fuera del primer corte.

### Icono de sombra (V2-Iconos-sombra)

- Pendiente de revisar: el archivo existe en el lienzo, pero no está leído en este registro.

## 6. Alcance del primer corte

Lo que pide la tarea y lo que dicen las fuentes:

- **Mapa con marcadores por estado, hora y fecha, y ficha:** en V2 existen las pantallas A, B, C y D
  (inglés). Corresponde a «mapa + hora + ficha».
- **Cerca de mí:** las fuentes lo marcan como función innegociable (brief sección 2, memoria del
  proyecto). En V2 no tiene pantalla; solo queda la referencia de V1 (`nD`) y el botón de la
  pantalla A. Hay que decidir si entra en el primer corte.
- **Estados vacío, ubicación denegada, aviso de limitaciones y tema oscuro en inglés:** existen en
  V1 (`E`, `F`, `G`, `H`), pero no en V2. Quedan fuera del primer corte salvo decisión contraria.
- **Nublado:** fase 2 (`v2n4`).
- **Escritorio:** existe en V2 (E), pero la prioridad es móvil (brief sección 2).

## 7. Idioma: ES y EN

- El brief lo marca como decidido: español e inglés desde el principio.
- En V2 solo hay una pantalla en inglés (D, Lotus). En V1 hay otra (H, tema oscuro).
- El cambio de idioma está en la barra (`nH`, V1). En V2 no hay pantalla de selector.

## 8. Mapa base

- Mapa desaturado, estilo **positron** de OpenFreeMap, para que destaquen los marcadores
  (brief sección 5, decidido).
- Atribución visible: «© OpenStreetMap · OpenFreeMap» (`V2-D`, footer). Ver también `nG`.

## Pendiente de verificar

1. **Contraste de la paleta sobre teselas reales.** Los contrastes del brief (azul 4,7–6,6;
   amarillo 1,0–1,3; tinta 12–17,5) son de V1 y sobre teselas de ejemplo. No hay cálculo para
   Wave ni para Lotus. Hay que medirlos sobre el positron real.
2. **Legibilidad a pleno sol.** Ningún archivo lo prueba. La nota `v2n2` pide probarlo en el móvil
   de Fernando.
3. **Hora a 84 px.** Supera el techo de 48 px del brief (sección 6). El lienzo lo marca como
   intencionado y ofrece bajarlo a 56 px (`v2n2`). Decisión de Fernando.
4. **Motivo de descartar V1.** No está escrito en los archivos leídos.
5. **Lotus: roles de color.** La asignación de hex a roles es inferida (sección 2). No hay tabla
   de tokens Lotus.
6. **Cerca de mí y pantallas V1 sin equivalente en V2.** Ver sección 6.
7. **Hex sin rol:** `#C8C093`, `#54546D`, `#2B3328`, `#223249`, `#2A2A37` (Wave) y
   `#e5ddb0`, `#d5dcb0`, `#c7d7e0`, `#43436c` (Lotus).
8. **Noche en Lotus:** no hay hex de noche en Lotus confirmado.
9. **Nombre exacto del estilo positron en OpenFreeMap:** el brief lo nombra, pero no se ha
   consultado openfreemap.org en este registro.
10. **Tipografía de cuerpo:** IBM Plex Sans aparece en V2, pero no está en el sistema V2.
11. **Icono de sombra:** no revisado.
12. **Fecha de la decisión V2:** el lienzo no tiene fecha de decisión, solo `createdOnFiles` del
    2026-11-16.
