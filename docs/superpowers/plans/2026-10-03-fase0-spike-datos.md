# Fase 0 — Spike de datos: plan de implementación

> **Histórico: fase 0 terminada** en cuanto a implementación del spike y preparación de la hoja de campo. La validación en la calle sigue pendiente. Este documento conserva el plan original; sus casillas y puertas de fase describen aquel momento. El prototipo web avanza en paralelo, identificado como modelo sin validar, pero la publicación general espera a la validación de campo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular, con datos reales de Málaga, si cada terraza está al sol o a la sombra a una hora dada, y dejar preparada la validación en persona de 5 terrazas.

**Architecture:** Scripts locales en TypeScript que leen las terrazas municipales y los edificios del Catastro, calculan un perfil de horizonte por terraza (180 ángulos, uno cada 2° de azimut) y escriben `src/data/terrazas.json`. Una función pura `estaAlSol` compara la posición del sol (`suncalc`) con ese perfil. No hay web todavía: la fase 1 tendrá su propio plan cuando la validación de campo pase.

**Tech Stack:** Node 24 (ejecuta `.ts` directamente y trae `node:test`), `suncalc`. Sin más dependencias.

**Spec:** `docs/superpowers/specs/2026-10-03-solysombra-mvp-design.md`

## Global Constraints

- 0 €/mes: solo datos y librerías gratuitos.
- TypeScript de principio a fin; imports relativos con extensión `.ts`.
- Coordenadas métricas en EPSG:25830 como `[x este, y norte]`; lat/lon solo para `suncalc` y la salida.
- Altura de edificio = `plantas × 3 m`. Radio de búsqueda de obstáculos = 150 m. 180 franjas de 2°; la franja `i` cubre el azimut `[2i, 2i+2)` medido desde el norte en sentido horario.
- `pipeline/raw/` no se versiona; `src/data/terrazas.json` sí.
- Un commit por tarea, mensaje en inglés.

## Review Focus

1. El punto municipal cae dentro del edificio del local: debe desplazarse a la calle, no dar "siempre sombra" (Task 2, test de `puntoMuestreo`).
2. El punto cae dentro de un edificio pegado a otro por la medianera: no debe acabar dentro del vecino (Task 2).
3. Partes de edificio con 0 plantas (patios, solares): no deben proyectar sombra ni atrapar el punto (Task 3).
4. Polígonos con patio interior (segundo `posList`): se usa solo el anillo exterior (Task 3).
5. Registros municipales sin nombre o sin coordenadas: se descartan y se cuentan, no rompen la exportación (Task 4).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/sol.ts` | `estaAlSol`: sol, sombra o noche a partir de un horizonte, posición y fecha. La usará también la web. |
| `pipeline/geometria.ts` | Geometría pura: punto en polígono, horizonte, punto de muestreo, índice espacial. |
| `pipeline/catastro.ts` | Lectura del GML de edificios del Catastro. |
| `pipeline/terraza.ts` | Conversión de un registro municipal en una terraza con horizonte. |
| `pipeline/descargar.ts` | Descarga de los datos a `pipeline/raw/`. |
| `pipeline/exportar.ts` | Orquesta todo y escribe `src/data/terrazas.json`. |
| `pipeline/horas.ts` | CLI: tabla horaria sol/sombra de una terraza. |

---

### Task 1: Proyecto y función `estaAlSol`

**Files:**
- Create: `package.json`, `.gitignore`, `src/lib/sol.ts`
- Test: `src/lib/sol.test.ts`

**Interfaces:**
- Produces: `estaAlSol(horizonte: number[], lat: number, lon: number, fecha: Date): Estado`, `type Estado = 'sol' | 'sombra' | 'noche'`, `GRADOS_POR_FRANJA = 2`.

- [ ] **Step 1: Crear `package.json` y `.gitignore`**

`package.json`:
```json
{
  "name": "solysombra",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "datos:descargar": "node pipeline/descargar.ts",
    "datos:exportar": "node pipeline/exportar.ts",
    "horas": "node pipeline/horas.ts"
  }
}
```

`.gitignore`:
```
node_modules/
pipeline/raw/
dist/
.astro/
```

Run: `npm install suncalc`

- [ ] **Step 2: Escribir el test que falla**

`src/lib/sol.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estaAlSol } from './sol.ts';

const LAT = 36.72, LON = -4.42; // Málaga
const plano = (grados: number) => new Array(180).fill(grados);

test('de noche devuelve noche', () => {
  assert.equal(estaAlSol(plano(0), LAT, LON, new Date('2026-01-15T02:00:00Z')), 'noche');
});

test('horizonte despejado a mediodía: sol', () => {
  assert.equal(estaAlSol(plano(0), LAT, LON, new Date('2026-06-21T12:00:00Z')), 'sol');
});

test('horizonte tapado a mediodía: sombra', () => {
  assert.equal(estaAlSol(plano(89), LAT, LON, new Date('2026-06-21T12:00:00Z')), 'sombra');
});

test('obstáculo de 45°: sol en verano, sombra en invierno', () => {
  assert.equal(estaAlSol(plano(45), LAT, LON, new Date('2026-06-21T12:00:00Z')), 'sol');
  assert.equal(estaAlSol(plano(45), LAT, LON, new Date('2026-12-21T12:00:00Z')), 'sombra');
});

test('obstáculo solo al este: sombra por la mañana, sol por la tarde', () => {
  const este = plano(0).map((_, i) => (i < 90 ? 89 : 0)); // azimut 0-180°
  assert.equal(estaAlSol(este, LAT, LON, new Date('2026-06-21T07:00:00Z')), 'sombra');
  assert.equal(estaAlSol(este, LAT, LON, new Date('2026-06-21T17:00:00Z')), 'sol');
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no encuentra `./sol.ts`.

- [ ] **Step 4: Implementar**

`src/lib/sol.ts`:
```ts
import SunCalc from 'suncalc';

export type Estado = 'sol' | 'sombra' | 'noche';
export const GRADOS_POR_FRANJA = 2;

const GRADOS = 180 / Math.PI;

export function estaAlSol(horizonte: number[], lat: number, lon: number, fecha: Date): Estado {
  const { azimuth, altitude } = SunCalc.getPosition(fecha, lat, lon);
  const altura = altitude * GRADOS;
  if (altura <= 0) return 'noche';
  // suncalc mide el azimut desde el sur hacia el oeste; lo pasamos a norte en sentido horario
  const azimut = (azimuth * GRADOS + 180 + 360) % 360;
  const franja = Math.floor(azimut / GRADOS_POR_FRANJA) % horizonte.length;
  return altura > horizonte[franja] ? 'sol' : 'sombra';
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore src/lib
git commit -m "Add estaAlSol sun/shade function"
```

---

### Task 2: Geometría (horizonte, punto de muestreo, índice)

**Files:**
- Create: `pipeline/geometria.ts`
- Test: `pipeline/geometria.test.ts`

**Interfaces:**
- Produces:
  - `type Punto = [number, number]`
  - `type Edificio = { anillo: Punto[]; altura: number }`
  - `FRANJAS = 180`, `RADIO = 150`
  - `dentro(p: Punto, anillo: Punto[]): boolean`
  - `horizonte(p: Punto, edificios: Edificio[]): number[]`
  - `puntoMuestreo(p: Punto, edificios: Edificio[]): Punto`
  - `crearIndice(edificios: Edificio[]): (p: Punto) => Edificio[]`

- [ ] **Step 1: Escribir los tests que fallan**

`pipeline/geometria.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dentro, horizonte, puntoMuestreo, crearIndice, type Edificio, type Punto } from './geometria.ts';

const cuadrado = (x0: number, y0: number, x1: number, y1: number): Punto[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

test('dentro: punto interior y exterior', () => {
  assert.equal(dentro([5, 5], cuadrado(0, 0, 10, 10)), true);
  assert.equal(dentro([15, 5], cuadrado(0, 0, 10, 10)), false);
});

test('horizonte sin edificios: todo a 0', () => {
  const h = horizonte([0, 0], []);
  assert.equal(h.length, 180);
  assert.ok(h.every((v) => v === 0));
});

test('horizonte: muro de 10 m a 10 m al norte', () => {
  const muro: Edificio = { anillo: cuadrado(-20, 10, 20, 20), altura: 10 };
  const h = horizonte([0, 0], [muro]);
  assert.equal(h[0], 45);  // norte: atan(10/10)
  assert.equal(h[22], 35); // 45° al noreste: atan(10/14,1)
  assert.equal(h[45], 0);  // este
  assert.equal(h[90], 0);  // sur
});

test('horizonte: edificio a más de 150 m no cuenta', () => {
  const lejos: Edificio = { anillo: cuadrado(-500, 200, 500, 210), altura: 100 };
  assert.ok(horizonte([0, 0], [lejos]).every((v) => v === 0));
});

test('puntoMuestreo: punto dentro del edificio sale 3 m a la calle', () => {
  const a: Edificio = { anillo: cuadrado(0, 0, 10, 10), altura: 9 };
  assert.deepEqual(puntoMuestreo([5, 1], [a]), [5, -3]);
});

test('puntoMuestreo: no acaba dentro del edificio vecino', () => {
  const a: Edificio = { anillo: cuadrado(0, 0, 10, 10), altura: 9 };
  const vecino: Edificio = { anillo: cuadrado(0, -10, 10, 0), altura: 9 };
  const p = puntoMuestreo([5, 1], [a, vecino]);
  assert.deepEqual(p, [13, 1]);
});

test('puntoMuestreo: punto pegado a la fachada se separa a 3 m', () => {
  const a: Edificio = { anillo: cuadrado(0, 0, 10, 10), altura: 9 };
  assert.deepEqual(puntoMuestreo([5, -1], [a]), [5, -3]);
});

test('puntoMuestreo: punto en plaza abierta no se mueve', () => {
  const a: Edificio = { anillo: cuadrado(0, 0, 10, 10), altura: 9 };
  assert.deepEqual(puntoMuestreo([5, -20], [a]), [5, -20]);
});

test('crearIndice: devuelve los cercanos y no los lejanos', () => {
  const cerca: Edificio = { anillo: cuadrado(50, 50, 60, 60), altura: 9 };
  const lejos: Edificio = { anillo: cuadrado(1000, 1000, 1010, 1010), altura: 9 };
  const buscar = crearIndice([cerca, lejos]);
  assert.deepEqual(buscar([0, 0]), [cerca]);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no encuentra `./geometria.ts`.

- [ ] **Step 3: Implementar**

`pipeline/geometria.ts`:
```ts
export type Punto = [number, number]; // [x este, y norte] en metros (EPSG:25830)
export type Edificio = { anillo: Punto[]; altura: number };

export const FRANJAS = 180;
export const RADIO = 150;
const SEPARACION = 3; // metros entre la fachada y el punto donde se mide

export function dentro(p: Punto, anillo: Punto[]): boolean {
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

// distancia desde p, en la dirección dir (unitaria), hasta el segmento ab; Infinity si no lo corta
function distRayo(p: Punto, dir: Punto, a: Punto, b: Punto): number {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = dir[0] * ey - dir[1] * ex;
  if (den === 0) return Infinity;
  const ax = a[0] - p[0], ay = a[1] - p[1];
  const t = (ax * ey - ay * ex) / den;
  const u = (ax * dir[1] - ay * dir[0]) / den;
  return t > 0 && u >= 0 && u <= 1 ? t : Infinity;
}

export function horizonte(p: Punto, edificios: Edificio[]): number[] {
  const h = new Array<number>(FRANJAS).fill(0);
  for (let i = 0; i < FRANJAS; i++) {
    const az = (((i + 0.5) * 360) / FRANJAS) * (Math.PI / 180);
    const dir: Punto = [Math.sin(az), Math.cos(az)];
    for (const e of edificios) {
      for (let k = 0; k < e.anillo.length; k++) {
        const d = distRayo(p, dir, e.anillo[k], e.anillo[(k + 1) % e.anillo.length]);
        if (d <= RADIO) h[i] = Math.max(h[i], Math.round(Math.atan2(e.altura, d) * (180 / Math.PI)));
      }
    }
  }
  return h;
}

function masCercano(p: Punto, a: Punto, b: Punto): Punto {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey || 1)));
  return [a[0] + t * ex, a[1] + t * ey];
}

// El punto municipal suele caer dentro del local o sobre la fachada: lo sacamos a la calle.
export function puntoMuestreo(p: Punto, edificios: Edificio[]): Punto {
  const libre = (q: Punto) => !edificios.some((e) => dentro(q, e.anillo));
  const estaDentro = !libre(p);
  const bordes: { d: number; q: Punto }[] = [];
  for (const e of edificios) {
    for (let k = 0; k < e.anillo.length; k++) {
      const q = masCercano(p, e.anillo[k], e.anillo[(k + 1) % e.anillo.length]);
      bordes.push({ d: Math.hypot(q[0] - p[0], q[1] - p[1]), q });
    }
  }
  bordes.sort((a, b) => a.d - b.d);
  if (!estaDentro && (bordes.length === 0 || bordes[0].d >= SEPARACION)) return p;
  const s = estaDentro ? 1 : -1; // dentro: cruzar la fachada; fuera: alejarse de ella
  for (const { d, q } of bordes) {
    if (d === 0) continue;
    const r: Punto = [
      q[0] + ((q[0] - p[0]) / d) * s * SEPARACION,
      q[1] + ((q[1] - p[1]) / d) * s * SEPARACION,
    ];
    if (libre(r)) return r;
  }
  return p;
}

// Rejilla de 150 m: cada edificio se apunta en las celdas que toca su caja; se consultan las 3×3 vecinas.
export function crearIndice(edificios: Edificio[]): (p: Punto) => Edificio[] {
  const celdas = new Map<string, Edificio[]>();
  const c = (v: number) => Math.floor(v / RADIO);
  for (const e of edificios) {
    const xs = e.anillo.map((v) => v[0]), ys = e.anillo.map((v) => v[1]);
    for (let x = c(Math.min(...xs)); x <= c(Math.max(...xs)); x++) {
      for (let y = c(Math.min(...ys)); y <= c(Math.max(...ys)); y++) {
        const k = `${x},${y}`;
        if (!celdas.has(k)) celdas.set(k, []);
        celdas.get(k)!.push(e);
      }
    }
  }
  return (p) => {
    const vistos = new Set<Edificio>();
    for (let x = c(p[0]) - 1; x <= c(p[0]) + 1; x++) {
      for (let y = c(p[1]) - 1; y <= c(p[1]) + 1; y++) {
        for (const e of celdas.get(`${x},${y}`) ?? []) vistos.add(e);
      }
    }
    return [...vistos];
  };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: todos los tests PASS (5 de `sol` y 9 de `geometria`).

- [ ] **Step 5: Commit**

```bash
git add pipeline/geometria.ts pipeline/geometria.test.ts
git commit -m "Add horizon profile geometry"
```

---

### Task 3: Descarga de datos y lectura del Catastro

**Files:**
- Create: `pipeline/descargar.ts`, `pipeline/catastro.ts`
- Test: `pipeline/catastro.test.ts`

**Interfaces:**
- Consumes: `Edificio`, `Punto` de `pipeline/geometria.ts`.
- Produces:
  - `SEPARADOR = '<bu-ext2d:BuildingPart '`
  - `parsearParte(trozo: string): Edificio | null`
  - `leerEdificios(ruta: string): Promise<Edificio[]>`
  - Ficheros en `pipeline/raw/`: `terrazas.geojson` y `A.ES.SDGC.BU.29900.buildingpart.gml`.

- [ ] **Step 1: Escribir `pipeline/descargar.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RAW = 'pipeline/raw';
const TERRAZAS = 'https://datosabiertos.malaga.eu/recursos/comercio/establecimientos/da_ovpMesasPlanos-4326.geojson';
const EDIFICIOS = 'https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/29/29900-MALAGA/A.ES.SDGC.BU.29900.zip';

async function bajar(url: string, destino: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} al descargar ${url}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log('descargado', destino);
}

mkdirSync(RAW, { recursive: true });
await bajar(TERRAZAS, `${RAW}/terrazas.geojson`);
await bajar(EDIFICIOS, `${RAW}/edificios.zip`);
// ponytail: descompresión solo en Windows (Expand-Archive); usar unzip si se ejecuta en otro sistema
execFileSync('powershell', ['-NoProfile', '-Command',
  `Expand-Archive -Force '${RAW}/edificios.zip' '${RAW}'`]);
```

- [ ] **Step 2: Descargar y comprobar los ficheros**

Run: `npm run datos:descargar`
Expected: dos líneas `descargado ...` y en `pipeline/raw/` aparece `A.ES.SDGC.BU.29900.buildingpart.gml`.

Si la descarga de edificios devuelve 404, la URL del municipio ha cambiado. Localizarla con:
`curl -s https://www.catastro.hacienda.gob.es/INSPIRE/buildings/29/ES.SDGC.bu.atom_29.xml | grep -o 'https[^"<]*29900[^"<]*zip'`
y sustituir `EDIFICIOS` y el nombre del `.gml` en este plan por lo que devuelva.

- [ ] **Step 3: Mirar el formato real antes de escribir el parser**

Run: `grep -m1 -n -A40 '<bu-ext2d:BuildingPart ' pipeline/raw/A.ES.SDGC.BU.29900.buildingpart.gml`
Expected: un elemento con `<gml:posList ...>` (pares `x y` con x≈370000, y≈4060000) y `<bu-ext2d:numberOfFloorsAboveGround>`.

Run: `node -e "const g=JSON.parse(require('fs').readFileSync('pipeline/raw/terrazas.geojson','utf8'));console.log(g.features.length, JSON.stringify(g.features[0]))"`
Expected: número de registros y un feature con `geometry.coordinates` `[lon, lat]` y propiedades `nombre_lugar`, `via`, `direccion_actividad`, `numero`, `distrito`, `x`, `y`, `metros`.

Si los nombres de etiqueta o de propiedad difieren, usar los reales en el fixture del Step 4, en `SEPARADOR`, en las expresiones regulares del Step 6 y en `aTerraza` (Task 4).

- [ ] **Step 4: Escribir el test que falla**

`pipeline/catastro.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearParte } from './catastro.ts';

const parte = (plantas: number, extra = '') => `gml:id="ES.SDGC.BU.X_part1">
<bu-ext2d:geometry><gml:Surface srsName="urn:ogc:def:crs:EPSG::25830"><gml:patches><gml:PolygonPatch>
<gml:exterior><gml:LinearRing><gml:posList srsDimension="2" count="5">0 0 10 0 10 10 0 10 0 0</gml:posList></gml:LinearRing></gml:exterior>
${extra}</gml:PolygonPatch></gml:patches></gml:Surface></bu-ext2d:geometry>
<bu-ext2d:numberOfFloorsAboveGround>${plantas}</bu-ext2d:numberOfFloorsAboveGround>`;

test('parte de 3 plantas: 9 m y su anillo', () => {
  assert.deepEqual(parsearParte(parte(3)), {
    anillo: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    altura: 9,
  });
});

test('parte de 0 plantas se descarta', () => {
  assert.equal(parsearParte(parte(0)), null);
});

test('con patio interior se usa solo el anillo exterior', () => {
  const patio = '<gml:interior><gml:LinearRing><gml:posList>4 4 6 4 6 6 4 6 4 4</gml:posList></gml:LinearRing></gml:interior>';
  assert.equal(parsearParte(parte(2, patio))!.anillo.length, 5);
});

test('la cabecera del fichero no es un edificio', () => {
  assert.equal(parsearParte('<?xml version="1.0"?><gml:FeatureCollection>'), null);
});
```

- [ ] **Step 5: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no encuentra `./catastro.ts`.

- [ ] **Step 6: Implementar**

`pipeline/catastro.ts`:
```ts
import { createReadStream } from 'node:fs';
import type { Edificio, Punto } from './geometria.ts';

export const SEPARADOR = '<bu-ext2d:BuildingPart ';
const METROS_POR_PLANTA = 3;

// ponytail: lectura por expresiones regulares, atada al formato GML actual del Catastro;
// pasar a un parser XML si el formato cambia. Solo anillo exterior: los patios se ignoran.
export function parsearParte(trozo: string): Edificio | null {
  const plantas = Number(/numberOfFloorsAboveGround>(\d+)</.exec(trozo)?.[1] ?? 0);
  const pos = /<gml:posList[^>]*>([^<]+)</.exec(trozo)?.[1];
  if (!plantas || !pos) return null;
  const n = pos.trim().split(/\s+/).map(Number);
  const anillo: Punto[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) anillo.push([n[i], n[i + 1]]);
  return { anillo, altura: plantas * METROS_POR_PLANTA };
}

// El fichero pesa cientos de MB: se lee en streaming y se corta por elemento.
export async function leerEdificios(ruta: string): Promise<Edificio[]> {
  const edificios: Edificio[] = [];
  let resto = '';
  for await (const trozo of createReadStream(ruta, 'utf8')) {
    const partes = (resto + trozo).split(SEPARADOR);
    resto = partes.pop()!;
    for (const p of partes) {
      const e = parsearParte(p);
      if (e) edificios.push(e);
    }
  }
  const ultimo = parsearParte(resto);
  if (ultimo) edificios.push(ultimo);
  return edificios;
}
```

- [ ] **Step 7: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: todos los tests PASS.

- [ ] **Step 8: Comprobar con el fichero real**

Run: `node -e "import('./pipeline/catastro.ts').then(async m=>{const e=await m.leerEdificios('pipeline/raw/A.ES.SDGC.BU.29900.buildingpart.gml');console.log(e.length, e[0], Math.max(...e.map(x=>x.altura)))})"`
Expected: decenas de miles de edificios, un primer elemento con coordenadas x≈370000 / y≈4060000 y una altura máxima razonable (menos de 150 m).

- [ ] **Step 9: Commit**

```bash
git add pipeline/descargar.ts pipeline/catastro.ts pipeline/catastro.test.ts
git commit -m "Add data download and Catastro building reader"
```

---

### Task 4: Exportación de `terrazas.json`

**Files:**
- Create: `pipeline/terraza.ts`, `pipeline/exportar.ts`, `src/data/terrazas.json` (generado)
- Test: `pipeline/terraza.test.ts`

**Interfaces:**
- Consumes: `horizonte`, `puntoMuestreo`, `dentro`, `crearIndice`, `Edificio`, `Punto` de `pipeline/geometria.ts`; `leerEdificios` de `pipeline/catastro.ts`.
- Produces:
  - `type Terraza = { id: string; nombre: string; direccion: string; distrito: string; lat: number; lon: number; metros: number; horizonte: number[] }`
  - `aTerraza(f: any, cerca: (p: Punto) => Edificio[]): Terraza | 'sin-datos' | 'sin-punto'`
  - `src/data/terrazas.json`: `Terraza[]`

- [ ] **Step 1: Escribir el test que falla**

`pipeline/terraza.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aTerraza } from './terraza.ts';

const registro = (props: object) => ({
  geometry: { type: 'Point', coordinates: [-4.4213, 36.7213] },
  properties: {
    nombre_lugar: 'BAR TORRES', via: 'CALLE', direccion_actividad: 'CONDE', numero: 18,
    distrito: 7, x: '370109.97', y: '4062095.17', metros: 5, ...props,
  },
});
const sinEdificios = () => [];

test('registro completo sin edificios cerca', () => {
  assert.deepEqual(aTerraza(registro({}), sinEdificios), {
    id: 'bar-torres-conde-18',
    nombre: 'BAR TORRES',
    direccion: 'CALLE CONDE 18',
    distrito: '7',
    lat: 36.7213,
    lon: -4.4213,
    metros: 5,
    horizonte: new Array(180).fill(0),
  });
});

test('acentos y símbolos en el id', () => {
  const t = aTerraza(registro({ nombre_lugar: 'CAFÉ & TÉ "EL NIÑO"' }), sinEdificios);
  assert.equal((t as any).id, 'cafe-te-el-nino-conde-18');
});

test('sin nombre: sin-datos', () => {
  assert.equal(aTerraza(registro({ nombre_lugar: '  ' }), sinEdificios), 'sin-datos');
});

test('sin coordenadas: sin-datos', () => {
  assert.equal(aTerraza(registro({ x: null }), sinEdificios), 'sin-datos');
  assert.equal(aTerraza({ ...registro({}), geometry: null }, sinEdificios), 'sin-datos');
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no encuentra `./terraza.ts`.

- [ ] **Step 3: Implementar `pipeline/terraza.ts`**

```ts
import { dentro, horizonte, puntoMuestreo, type Edificio, type Punto } from './geometria.ts';

export type Terraza = {
  id: string; nombre: string; direccion: string; distrito: string;
  lat: number; lon: number; metros: number; horizonte: number[];
};

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function aTerraza(f: any, cerca: (p: Punto) => Edificio[]): Terraza | 'sin-datos' | 'sin-punto' {
  const p = f.properties ?? {};
  const nombre = String(p.nombre_lugar ?? '').trim();
  const [lon, lat] = f.geometry?.coordinates ?? [];
  const x = p.x == null ? NaN : Number(p.x), y = p.y == null ? NaN : Number(p.y);
  if (!nombre || ![lon, lat, x, y].every(Number.isFinite)) return 'sin-datos';

  const edificios = cerca([x, y]);
  const punto = puntoMuestreo([x, y], edificios);
  // si no se ha podido sacar a la calle, el horizonte saldría tapado en todas direcciones
  if (edificios.some((e) => dentro(punto, e.anillo))) return 'sin-punto';

  const calle = [p.direccion_actividad, p.numero].filter((v) => v != null && v !== '').join(' ');
  return {
    id: slug(`${nombre} ${calle}`),
    nombre,
    direccion: [p.via, calle].filter(Boolean).join(' '),
    distrito: String(p.distrito ?? ''),
    lat, lon,
    metros: Number(p.metros) || 0,
    horizonte: horizonte(punto, edificios),
  };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: todos los tests PASS.

- [ ] **Step 5: Escribir `pipeline/exportar.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { leerEdificios } from './catastro.ts';
import { crearIndice } from './geometria.ts';
import { aTerraza, type Terraza } from './terraza.ts';

const RAW = 'pipeline/raw';
const edificios = await leerEdificios(`${RAW}/A.ES.SDGC.BU.29900.buildingpart.gml`);
const cerca = crearIndice(edificios);
const { features } = JSON.parse(readFileSync(`${RAW}/terrazas.geojson`, 'utf8'));

const terrazas: Terraza[] = [];
const ids = new Map<string, number>();
const cuenta = { 'sin-datos': 0, 'sin-punto': 0 };
for (const f of features) {
  const t = aTerraza(f, cerca);
  if (typeof t === 'string') { cuenta[t]++; continue; }
  const n = (ids.get(t.id) ?? 0) + 1;
  ids.set(t.id, n);
  if (n > 1) t.id += `-${n}`;
  terrazas.push(t);
}

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/terrazas.json', JSON.stringify(terrazas));

const media = (h: number[]) => h.reduce((a, b) => a + b, 0) / h.length;
console.log({
  edificios: edificios.length,
  registros: features.length,
  exportadas: terrazas.length,
  ...cuenta,
  despejadas: terrazas.filter((t) => media(t.horizonte) < 5).length,
  muyTapadas: terrazas.filter((t) => media(t.horizonte) > 60).length,
});
```

- [ ] **Step 6: Ejecutar y revisar los números**

Run: `npm run datos:exportar`
Expected: un resumen donde `exportadas + sin-datos + sin-punto = registros`, `sin-punto` por debajo del 5 % de los registros y `muyTapadas` por debajo del 5 % de las exportadas.

Si `sin-punto` o `muyTapadas` superan el 5 %, el desplazamiento a la calle no está funcionando: parar, listar 10 casos con su `x`, `y` y los edificios cercanos, y revisar `puntoMuestreo` con un test nuevo que reproduzca el caso antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add pipeline/terraza.ts pipeline/terraza.test.ts pipeline/exportar.ts src/data/terrazas.json
git commit -m "Export terraces with horizon profiles"
```

---

### Task 5: Tabla horaria y hoja de validación de campo

**Files:**
- Create: `pipeline/horas.ts`, `docs/validacion-campo.md`

**Interfaces:**
- Consumes: `estaAlSol` de `src/lib/sol.ts`; `src/data/terrazas.json`.
- Produces: CLI `npm run horas -- "<texto>" [AAAA-MM-DD]`.

- [ ] **Step 1: Escribir `pipeline/horas.ts`**

```ts
import { readFileSync } from 'node:fs';
import { estaAlSol } from '../src/lib/sol.ts';
import type { Terraza } from './terraza.ts';

const [texto, fecha = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!texto) {
  console.error('Uso: npm run horas -- "<nombre o calle>" [AAAA-MM-DD]');
  process.exit(1);
}

const terrazas: Terraza[] = JSON.parse(readFileSync('src/data/terrazas.json', 'utf8'));
const busca = texto.toUpperCase();
const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

for (const t of terrazas.filter((t) => `${t.nombre} ${t.direccion}`.toUpperCase().includes(busca))) {
  console.log(`\n${t.nombre} — ${t.direccion} (${t.id}) — ${fecha}`);
  const inicio = new Date(`${fecha}T04:00:00Z`).getTime();
  for (let i = 0; i < 38; i++) { // cada 30 min, de 04:00 a 22:30 UTC
    const d = new Date(inicio + i * 30 * 60000);
    const estado = estaAlSol(t.horizonte, t.lat, t.lon, d);
    if (estado !== 'noche') console.log(`  ${hora.format(d)}  ${estado}`);
  }
}
```

- [ ] **Step 2: Probar con una terraza real**

Run: `npm run horas -- "TORRES"`
Expected: al menos una terraza con una lista de medias horas de hoy marcadas `sol` o `sombra`, empezando cerca del amanecer y acabando cerca del atardecer en hora local.

Run: `npm run horas`
Expected: mensaje de uso y código de salida 1.

- [ ] **Step 3: Elegir las 5 terrazas de validación**

Elegir 5 terrazas de `src/data/terrazas.json` con entornos distintos, buscándolas con `npm run horas -- "<calle>"`:
1. Calle estrecha del centro histórico (por ejemplo, entorno de calle Granada o calle Beatas).
2. Plaza abierta del centro (plaza de la Merced o plaza de la Constitución).
3. Calle ancha (calle Larios o Alameda Principal).
4. Paseo marítimo (Pedregalejo o La Malagueta).
5. Barrio residencial de bloques altos (Teatinos o Huelin).

En cada una debe haber al menos un cambio sol↔sombra entre las 11:00 y las 19:00 del próximo sábado; si una está siempre al sol o siempre a la sombra, elegir otra de la misma zona, porque no sirve para comprobar el modelo.

- [ ] **Step 4: Escribir `docs/validacion-campo.md`**

Con la salida de `npm run horas -- "<texto>" <fecha del próximo sábado>` de las 5 elegidas, escribir un documento con:
- La fecha de la validación.
- Por cada terraza: nombre, dirección, enlace `https://www.google.com/maps?q=<lat>,<lon>` y una tabla con las columnas `Hora | Previsto | Real`, con una fila por cada media hora entre 11:00 y 19:00 y la columna `Real` vacía.
- La regla de aceptación de la spec: se visita cada terraza a una hora cercana a su cambio sol↔sombra; con más de 1 terraza fallada de 5 se revisa el modelo antes de construir la web.
- Qué anotar si falla: si la sombra la da un toldo, sombrilla o árbol (limitación conocida) o un edificio (error del modelo).

- [ ] **Step 5: Commit**

```bash
git add pipeline/horas.ts docs/validacion-campo.md
git commit -m "Add hourly sun table and field validation sheet"
```

---

## Punto de aprobación

Al terminar la Task 5 se entrega `docs/validacion-campo.md` a Fernando. La fase 1 (web) no empieza hasta tener el resultado de la validación.
