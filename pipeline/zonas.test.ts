import { test } from 'node:test';
import assert from 'node:assert/strict';
import zonasJson from '../src/data/zonas.json' with { type: 'json' };
import { ZONAS, resolverZonas, type ZonaUnida } from '../src/lib/alias.ts';
import barrios from '../src/data/barrios.json' with { type: 'json' };
import terrazas from '../src/data/terrazas.json' with { type: 'json' };
import { areaM2, quitarIslas, unir } from './zonas.ts';
import type { Poligono } from './barrios.ts';

// Cuadrado antihorario de lado `l` grados (0.001° ≈ 100 m) con esquina en (x, y).
const cuadro = (x: number, y: number, l = 0.001): Poligono => [[[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]]];
const aristas = (r: number[][]) => r.slice(1).map((p, i) => [r[i], p]);
const tiene = (r: number[][], a: number[], b: number[]) => aristas(r).some(([p, q]) => [p, q].flat().join() === [a, b].flat().join() || [q, p].flat().join() === [a, b].flat().join());

test('unión de dos cuadrados adyacentes: un anillo y sin arista interior', () => {
  const u = unir([cuadro(0, 0), cuadro(0.001, 0)]);
  assert.equal(u.length, 1);
  assert.equal(u[0].length, 1);
  assert.equal(tiene(u[0][0], [0.001, 0], [0.001, 0.001]), false);
  assert.ok(Math.abs(areaM2(u[0][0]) - 2 * areaM2(cuadro(0, 0)[0])) < 1);
});

test('unión de ocho cuadrados alrededor de uno ausente: un exterior con su agujero', () => {
  const polis: Poligono[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) polis.push(cuadro(i * 0.001, j * 0.001));
  const u = unir(polis);
  assert.equal(u.length, 1);
  assert.equal(u[0].length, 2); // exterior + agujero legítimo
  assert.ok(areaM2(u[0][1]) < 0);
});

test('micro-agujeros (<50 m²) se eliminan, uno grande se conserva; partes sin contacto siguen separadas', () => {
  const horario = (x: number, y: number, l: number) => [[x, y], [x, y + l], [x + l, y + l], [x + l, y], [x, y]]; // agujero = horario
  const pequeño = unir([[...cuadro(0, 0, 0.01), horario(0.004, 0.004, 0.00003)]]); // ~10 m²
  assert.equal(pequeño[0].length, 1);
  const grande = unir([[...cuadro(0, 0, 0.01), horario(0.004, 0.004, 0.001)]]); // ~10 000 m²
  assert.equal(grande[0].length, 2);
  assert.equal(unir([cuadro(0, 0), cuadro(0.01, 0.01)]).length, 2);
});

test('quitarIslas: descarta la pequeña y lejana, conserva la pequeña pegada al núcleo', () => {
  const grande = cuadro(0, 0, 0.01), lejos = cuadro(0.05, 0, 0.0005), cerca = cuadro(0.0102, 0, 0.0005);
  const { quedan, fuera } = quitarIslas([lejos, grande, cerca]);
  assert.equal(quedan.length, 2);
  assert.deepEqual(fuera, [lejos]);
});

test('zonas.json: cada zona compuesta tiene contorno y ninguna arista queda compartida entre sus anillos', () => {
  const unidas = zonasJson as unknown as ZonaUnida[];
  const esperadas = ZONAS.filter((d) => d.distrito || (d.barrios && d.barrios.length > 1)).map((d) => d.id);
  assert.deepEqual(unidas.map((u) => u.id), esperadas);
  for (const u of unidas) {
    const polis = (u.geometria.type === 'Polygon' ? [u.geometria.coordinates] : u.geometria.coordinates) as number[][][][];
    const vistas = new Set<string>();
    for (const p of polis) for (const r of p) for (const [a, b] of aristas(r)) {
      const k = [a.join(), b.join()].sort().join('|');
      assert.equal(vistas.has(k), false, `${u.id}: arista compartida ${k}`);
      vistas.add(k);
    }
    assert.ok(u.bbox[0] < u.bbox[2] && u.bbox[1] < u.bbox[3], u.id);
  }
});

test('resolverZonas usa el contorno unido y su bbox', () => {
  const unidas = zonasJson as unknown as ZonaUnida[];
  const z = resolverZonas(ZONAS, barrios as never, terrazas as never, unidas).find((x) => x.id === 'el-palo')!;
  assert.equal(z.geometrias.length, 1);
  assert.deepEqual(z.bbox, unidas.find((u) => u.id === 'el-palo')!.bbox);
});
