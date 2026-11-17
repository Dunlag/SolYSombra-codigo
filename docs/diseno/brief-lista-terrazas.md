# Brief para Claude Design: pantalla «Lista de terrazas»

Fecha: 2026-11-16. Proyecto: Sol y Sombra (raíz del repositorio: `.`).
Estilo: V2 Kanagawa, ya implementado en `src/styles/tokens.css`. Este brief pide solo la pantalla
nueva; el resto del sistema visual no cambia.

Fuentes leídas para escribir este brief:
- `docs/diseno/decisiones-v2-kanagawa.md`
- `docs/diseno/brief-claude-design.md`
- `src/styles/tokens.css`
- `src/components/App.tsx`, `src/components/Ficha.tsx`, `src/components/SelectorHora.tsx`
- `src/lib/terrazas.ts` (tipo `Terraza`), `src/lib/ficha.ts` (`tramoActual`, `lineaDia`)
- Informe de auditoría WCAG 2.2 AA (`auditoria-a11y.md`, hallazgo 1 y contrastes)

Las cifras de contraste vienen del informe de auditoría. No las he recalculado.

---

## 1. Por qué existe esta pantalla

Dos motivos.

**a) Accesibilidad (hallazgo 1, alta gravedad).** El mapa no se puede recorrer con teclado ni con
lector de pantalla. Los marcadores son una capa de símbolos de WebGL: solo el canvas recibe foco, y
Tab no pasa de un marcador a otro. Esto incumple WCAG 2.1.1 (teclado) y 4.1.2 (nombre, función y
valor). `App.tsx` ya lo deja anotado en su cabecera: «pendiente, pantalla D», con la lista como
alternativa propuesta. Sin esta pantalla, una persona que no usa ratón o no ve el mapa no puede elegir
una terraza.

**b) Producto.** Es la pantalla D «Cerca de mí» de la V1 (`canvas.json`, nota `nD`). En V2 no existe
pantalla propia. La función «Cerca de mí» es innegociable según el brief (sección 2) y la memoria del
proyecto. La nota de la pantalla A (de la V1, `canvas.json` nota `nA`) dice que «Ver lista» abre «Cerca de mí»;
en V2 ese botón no está descrito (`decisiones-v2-kanagawa.md`, pantalla A). Hay que confirmarlo.

## 2. Qué debe permitir

1. **Ver las terrazas en una lista.** Dos órdenes, que el usuario elige con un control:
   - **Por distancia.** Requiere la ubicación del usuario. La ubicación se pide **solo al pulsar un
     botón** («Cerca de mí»), nunca al cargar la página (`canvas.json`, nota `nD`; brief sección 3).
     Orden: la más cercana primero.
   - **Por estado.** Sin ubicación. Primero las que están al sol, luego a la sombra, luego de noche.
     Dentro de cada grupo, por nombre. Esta vista funciona aunque el usuario deniegue la ubicación.
2. **Elegir una terraza.** Pulsar una fila abre la **Ficha existente** (`src/components/Ficha.tsx`).
   La lista no tiene ficha propia. Al cerrar la ficha, el foco vuelve a la fila elegida.
3. **Filtro «solo al sol a esta hora».** Muestra solo las terrazas con estado `sol` a la hora elegida
   en el selector de hora. El filtro se activa y desactiva con un interruptor visible con texto.
4. **Radio de 500 m.** Propuesta de la V1 (`canvas.json`, nota `nD`: «radio 500 m (propuesta)»). **Sin
   confirmar por Fernando.** Solo se aplica al orden por distancia.
5. **Alternancia Mapa / Lista.** Un control con dos opciones (Mapa, Lista) que cambia de vista y
   **conserva la hora elegida**. Cambiar de vista no reinicia el selector ni la fecha.

## 3. Estados a diseñar

Cada estado en Wave (oscuro) y en Lotus (claro), ES y EN.

| Estado | Qué se muestra | Acción |
|---|---|---|
| **Con resultados** | Lista de filas (sección 4) | Pulsar una fila abre la Ficha |
| **Vacía** | «Ninguna terraza con sol a esta hora» (frase de la V1, `nF`) | Botón que salta a una hora con sol. Hora exacta: sin verificar, la calcula la app |
| **Ubicación denegada** | El mapa sigue centrado en Málaga; el botón «Cerca de mí» muestra el icono tachado | Botón **Reintentar** (vuelve a pedir el permiso). Explicación de cómo activar la ubicación en el navegador si está bloqueada del todo |
| **Cargando** | Indicador mientras se pide la ubicación o se calcula la lista | Sin animaciones si el usuario las desactiva (`prefers-reduced-motion`, ya en `tokens.css`) |

Textos de la V1 usados como base (`canvas.json`, notas `nE` y `nF`). Los textos definitivos no están
escritos. **Sin verificar**: el texto exacto de la explicación de permisos.

## 4. Datos por fila

Cada fila muestra, en este orden:

1. **Nombre** de la terraza (`nombre`).
2. **Distrito** (`distrito`).
3. **Estado**: icono + palabra («Sol», «Sombra», «Noche»). Nunca solo color ni solo icono.
   Los iconos son los de la Ficha: círculo con rayos (sol), cuadrado rayado (sombra), rombo con luna
   (noche). Ver `src/components/Ficha.tsx`, línea 29.
4. **Hasta qué hora** sigue así: «HASTA LAS» + hora. Sale de `tramoActual` (`src/lib/ficha.ts`). Si no
   hay cambio en el día, se muestra «—» y el texto de `tf.sinCambios` (`src/components/Ficha.tsx`,
   línea 113).
5. **Distancia** en metros desde la ubicación del usuario. Solo si hay ubicación. **Sin verificar**: el
   método de cálculo (no existe función de distancia en `src/lib/` leído aquí).

**No mostrar** el campo `metros` del dataset. Su significado no está confirmado (brief sección 4).

## 5. Restricciones de accesibilidad

- **Cada fila es un `<button>` real** (no un `div` con `onClick`), con un área táctil de al menos
  **44 px** de alto (`--ss-tap: 44px` en `tokens.css`).
- **El nombre accesible incluye el estado en texto.** Ejemplo: «La Terraza de la Merced, Sol hasta
  las 15:20, Centro». No puede depender del icono ni del color.
- **No usar `aria-pressed` en las filas ni en los botones de acción.** El selector de hora lo usa
  mal hoy en los chips («Ahora», «+1 h», «Tarde», «Mañana»): un lector anuncia «pulsado» en botones
  que no son interruptores (`SelectorHora.tsx`, línea 129; hallazgo 13). Para la selección usar
  `aria-current` o un texto explícito.
- **Orden de foco = orden visual.** Cabecera → control de vista → filtro → ordenación → lista. Con la
  Ficha abierta, el foco pasa al título de la Ficha (`Ficha.tsx`, líneas 42-56, ya implementado).
- **La Ficha no debe tapar el foco** (WCAG 2.4.11). Hallazgo 4 de la auditoría: sigue abierto porque
  `App.tsx` no pasa `onNivel` a `Ficha`. La lista debe tenerlo en cuenta.
- **Contraste de los tokens** (`src/styles/tokens.css`). Cifras de la auditoría, no recalculadas:

  | Par | Wave | Lotus |
  |---|---|---|
  | texto / hueco | 12,41 | 13,62 |
  | texto / tile | 11,26 | 11,91 |
  | sol / tile | 9,73 | **1,78** |
  | sombra / tile | 5,94 | 4,02 |
  | foco / hueco | 8,75 | **1,71** |
  | foco / tile | 7,94 | **1,50** |
  | borde / tile | **1,38** | 5,41 |

  **Aviso importante.** En Lotus, el foco (`--ss-foco`, sigue en `#FF9E3B`) y el sol (`#DE9800`) están
  por debajo de 3:1 sobre los fondos. Ambos se están ajustando (decisión abierta en
  `decisiones-v2-kanagawa.md`, pendiente 1). **No diseñar la pantalla Lotus con estos valores como
  definitivos.** Marcar en el diseño dónde va el foco y el sol, para cambiarlos sin rehacer la pantalla.

  Lotus: el sol debe llevar un contorno de tinta, como ya hace la Ficha (la auditoría lo propone en
  `SelectorHora.css`, hallazgo 9).

- **Idioma.** La lista debe funcionar en ES y EN. Los nombres de terraza no se traducen.

## 6. Entregables que pido

1. **Móvil, ancho 390 px**, en **Wave** y en **Lotus**, con los cuatro estados de la sección 3.
2. **Textos en ES y EN** para cada estado y para los controles.
3. **Escritorio** (ancho 1440 px): la lista ocupa la columna izquierda del tile de escritorio
   (`decisiones-v2-kanagawa.md`, pantalla E). Solo esa columna; el resto no cambia.
4. **Anotaciones de interacción**: qué pasa al pulsar cada control, dónde va el foco al abrir y cerrar
   la Ficha, qué ocurre al denegar la ubicación.

## 7. Lo que NO hay que cambiar

- **Tokens** de `src/styles/tokens.css`: colores, espacios, radios, bordes, tamaños de foco.
- **Tipografías**: Archivo para cifras y títulos, Instrument Serif para etiquetas, JetBrains Mono para
  datos cortos. Sin cambios de familia.
- **Marcadores** del mapa y sus iconos (`/marcadores/`).
- **La Ficha** (`src/components/Ficha.tsx`): la lista la abre, no la rediseña.
- **El selector de hora** (`src/components/SelectorHora.tsx`): la lista lo lee, no lo cambia.
- **La estructura de la pantalla A** (mapa, selector debajo, cabecera).

## 8. Sin verificar

- Radio de 500 m: propuesta de la V1, no confirmada.
- Hora exacta que salta el botón de la pantalla vacía.
- Texto definitivo de la explicación de permisos de ubicación.
- Método de cálculo de la distancia.
- Contrastes de la tabla de la sección 5: calculados por la auditoría, no recalculados aquí.
- Comportamiento real con lector de pantalla y con zoom al 200 %/400 %: no probado en navegador.
- Hallazgo 4 de la auditoría (`inert` al abrir la Ficha): abierto en el código leído.
