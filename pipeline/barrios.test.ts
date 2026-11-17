import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirBarrios, dentroDeGeometria, leerBarrios, simplificarAnillo, type Geometria } from './barrios.ts';

const cuadrado = (x: number, y: number, l: number): [number, number][] => [[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]];

test('punto en polígono: dentro, fuera y en agujero', () => {
  const g: Geometria = { type: 'Polygon', coordinates: [cuadrado(0, 0, 10), cuadrado(4, 4, 2)] };
  assert.equal(dentroDeGeometria([1, 1], g), true);
  assert.equal(dentroDeGeometria([5, 5], g), false); // agujero
  assert.equal(dentroDeGeometria([11, 5], g), false);
});

test('MultiPolygon: vale cualquiera de sus partes', () => {
  const g: Geometria = { type: 'MultiPolygon', coordinates: [[cuadrado(0, 0, 1)], [cuadrado(10, 10, 1)]] };
  assert.equal(dentroDeGeometria([10.5, 10.5], g), true);
  assert.equal(dentroDeGeometria([5, 5], g), false);
});

test('Douglas-Peucker quita puntos casi alineados y conserva esquinas', () => {
  // ~0.00001° de lat ≈ 1 m de desvío: bajo la tolerancia de 5 m
  const r = simplificarAnillo([[0, 0], [0.005, 0.00001], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]], 5)!;
  assert.equal(r.length, 5);
  assert.deepEqual(r[0], r[r.length - 1]);
  // un desvío de ~100 m se conserva
  assert.equal(simplificarAnillo([[0, 0], [0.005, 0.001], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]], 5)!.length, 6);
});

test('anillo degenerado: null', () => assert.equal(simplificarAnillo([[0, 0], [1, 1], [0, 0]], 5), null));

test('construirBarrios asigna terrazas, descarta barrios vacíos y cuenta las huérfanas', () => {
  const entrada = leerBarrios({ features: [
    { properties: { ID_BARRIO: 1, NOMBARRIO: 'LA MALAGUETA   ' }, geometry: { type: 'Polygon', coordinates: [cuadrado(0, 0, 1).map(([x, y]) => [x, y, 0.00003])] } },
    { properties: { ID_BARRIO: 2, NOMBARRIO: 'VACIO' }, geometry: { type: 'Polygon', coordinates: [cuadrado(5, 5, 1)] } },
  ] });
  assert.equal(entrada[0].nombre, 'LA MALAGUETA');
  const { barrios, sinBarrio } = construirBarrios(entrada, [
    { id: 'a', lon: 0.5, lat: 0.5 }, { id: 'b', lon: 9, lat: 9 },
  ]);
  assert.equal(barrios.length, 1);
  assert.deepEqual(barrios[0].terrazas, ['a']);
  assert.deepEqual(barrios[0].bbox, [0, 0, 1, 1]);
  assert.deepEqual(barrios[0].geometria.coordinates[0].map((p) => p.length), [2, 2, 2, 2, 2]);
  assert.deepEqual(sinBarrio, ['b']);
});
