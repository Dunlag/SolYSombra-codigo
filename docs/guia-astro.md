# Guía de Astro para quien viene de React + Vite

Pensada para Fernando: sabe React y TypeScript, nunca ha usado Astro, y quiere entender el porqué
de cada paso. Las fuentes son la documentación oficial (docs.astro.build), consultada el 2026-11-16.
Lo que no se ha podido confirmar en la doc se marca **sin verificar**.

## 1. Qué es Astro

Astro genera **HTML estático** en el momento de construir (`npm run build`). El navegador recibe
páginas ya escritas y solo carga JavaScript donde hace falta.

Con React + Vite, la app entera es JavaScript: el navegador descarga un bundle y lo ejecuta para
pintar la página. Con Astro, la página llega como HTML y solo los componentes interactivos traen
su JavaScript.

Para SolYSombra esto importa porque la mayor parte de la web es texto (nombre, dirección, distrito,
avisos y atribuciones) y no necesita JavaScript. Solo el mapa es interactivo.

## 2. Islas: qué es y por qué el mapa es una

La documentación de Astro llama **isla** a un componente interactivo dentro de una página HTML
estática: «an enhanced UI component on an otherwise static page of HTML» (docs de islas).

```
página Astro (HTML estático)
├── cabecera         ← HTML puro, sin JavaScript
├── texto y avisos   ← HTML puro
└── <Mapa />         ← isla React: aquí sí hay JavaScript
```

Un componente React en `src/components/` **no se hidrata solo**. Hay que indicar a Astro cuándo
cargarlo con una directiva `client:*`.

| Directiva | Cuándo se carga el JavaScript del componente |
|---|---|
| `client:load` | en cuanto carga la página |
| `client:idle` | cuando el navegador está libre (acepta `timeout`) |
| `client:visible` | cuando el componente entra en pantalla |
| `client:media` | cuando se cumple una media query, por ejemplo `(max-width: 50em)` |
| `client:only="react"` | solo en el navegador; **no** se renderiza en el servidor |

### Por qué el mapa usa `client:only="react"`

```astro
---
import Mapa from '../components/Mapa.tsx';
---
<Mapa client:only="react" />
```

- La directiva `client:only` **salta el renderizado en el servidor** y pinta solo en el navegador.
  La doc exige pasar el nombre del framework como valor: `react`, `preact`, `svelte`, `vue` o
  `solid-js`.
- MapLibre GL necesita `window`, el DOM y WebGL. En la fase de construcción no existen. Si Astro
  intentara renderizar el mapa allí, fallaría. **Razonamiento propio**: la doc no menciona MapLibre;
  la consecuencia práctica está confirmada, la causa exacta de cada error no.
- Sin `client:*`, Astro no envía JavaScript de ese componente: el mapa aparecería como HTML vacío.

## 3. Rutas: un archivo es una página

En React Router defines rutas en código. En Astro, **cada archivo de `src/pages/` es una ruta**:

```
src/pages/
├── index.astro         → /
├── acerca.astro        → /acerca
└── terrazas/[id].astro → /terrazas/:id   (ruta dinámica)
```

La doc de rutas dice que un archivo sin parámetro en el nombre crea una sola página. Un archivo con
un parámetro entre corchetes, como `[slug].astro`, puede generar muchas.

Para SolYSombra, la fase 1 usa `src/pages/index.astro` (el mapa). No hace falta más.

## 4. `getStaticPaths()`: para la fase 2 (SEO)

La fase 2 creará una página por terraza o por barrio (spec, sección «Web»). Ahí entra
`getStaticPaths`:

```astro
---
// src/pages/terrazas/[id].astro
import terrazas from '../../data/terrazas.json';

export async function getStaticPaths() {
  return terrazas.map((t) => ({
    params: { id: String(t.id) },   // las claves deben coincidir con [id]; los valores, string
    props: { terraza: t },          // llega a la página como Astro.props
  }));
}

const { terraza } = Astro.props;
---
<h1>{terraza.nombre}</h1>
```

Puntos de la doc:

- Debe devolver un **array** de objetos con `params`. Los valores de `params` son **string**.
- `props` no tiene esa restricción y se pasa a la página como `Astro.props`.
- Se usa en archivos dinámicos que se generan en la construcción, que es el modo por defecto.

Por eso el JSON de terrazas (spec, sección «Pipeline») se diseña para la fase 2: `getStaticPaths` lo
lee una vez al construir y crea una página por registro.

## 5. Importar JSON y TypeScript

Dentro del bloque `---` de un `.astro`, se importa como en TypeScript normal:

```astro
---
import terrazas from '../data/terrazas.json';   // JSON: el objeto completo
import { estaAlSol } from '../lib/sol';         // .ts sin extensión
import type { Terraza } from '../lib/tipos';    // solo tipos
---
```

- **JSON**: soportado directamente. El import por defecto devuelve el objeto completo (doc de imports).
- **TypeScript**: se importa sin la extensión `.ts`. No se escribe `.ts` ni `.tsx` en la ruta.
- **Alias de rutas** (`@lib/sol`): soportados mediante `compilerOptions.paths` en `tsconfig.json`
  (doc de imports). **Sin verificar** que el proyecto ya los configure.

## 6. Por qué `sol.ts` es lógica pura

El spec dice: `estaAlSol(horizonte, lat, lon, fecha)` es una función pura que usan el mapa y la
generación de páginas.

«Pura» significa: la misma entrada da siempre la misma salida, y no toca el DOM, la red ni
`window`. Por eso:

1. **Se puede probar sin navegador.** Un test de Node llama a `estaAlSol` con un horizonte y una
   fecha. El spec pide exactamente esos tests.
2. **La usa la fase 2 en la construcción.** `getStaticPaths` corre en Node, sin navegador. Si la
   función dependiera de `window`, no podría usarse ahí.
3. **Se reutiliza en la app móvil.** La app nativa (spec, «Fuera de alcance» y brief sección 1)
   tendrá su propia interfaz, pero el cálculo sol/sombra es el mismo. Si `sol.ts` no depende de
   React ni de Astro, se copia o se importa sin cambios.

Regla práctica: el componente React pinta; `sol.ts` calcula. Así la interfaz puede cambiar (web,
móvil) sin tocar el cálculo.

## 7. Estructura prevista

Según el spec y el brief. **No existe todavía**: lo crea otro worker.

```
SolYSombra/
├── astro.config.mjs        ← configuración de Astro (integraciones: React, etc.)
├── src/
│   ├── pages/              ← cada archivo es una ruta
│   ├── components/         ← componentes React (islas) y .astro
│   ├── layouts/            ← estructura común (cabecera, pie, <head>)
│   ├── lib/                ← lógica pura: sol.ts
│   └── data/               ← terrazas.json (generado por pipeline/)
├── public/                 ← archivos sin procesar (iconos, manifest)
└── pipeline/               ← scripts de datos, se ejecutan a mano
```

Según la doc de estructura del proyecto (docs.astro.build), `src/pages/` es obligatoria; `components/`
y `layouts/` son convenciones opcionales; `public/` se copia tal cual; `astro.config.mjs` es
recomendado. **Sin verificar** en este repo.

### Estructura real

[COMPLETAR cuando termine la base]

## 8. Glosario

- **Astro**: generador de sitios que produce HTML estático y solo envía JavaScript para las islas.
- **Isla**: componente interactivo dentro de una página estática; se hidrata por separado.
- **Hidratación**: proceso por el que un componente HTML estático se vuelve interactivo al cargar
  su JavaScript en el navegador.
- **Directiva `client:*`**: atributo en un componente que indica cuándo se carga su JavaScript
  (`load`, `idle`, `visible`, `media`, `only`).
- **Ruta por archivo**: cada archivo en `src/pages/` se convierte en una URL.
- **`getStaticPaths`**: función que lista las URLs dinámicas que se generan al construir.
- **`params` / `props`**: `params` define los valores de la URL (strings); `props` son datos que la
  página recibe como `Astro.props`.
- **Función pura**: devuelve siempre lo mismo para la misma entrada y no tiene efectos secundarios.
- **Build (construcción)**: ejecutar `astro build`, que genera la carpeta `dist/` con el HTML final.
- **MapLibre GL**: librería de mapas que dibuja en WebGL dentro del navegador; no se renderiza en el
  servidor.
