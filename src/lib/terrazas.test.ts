import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aGeoJSON, contarAlSol, estados, type Terraza } from './terrazas.ts';

const t = (id: string, grados: number): Terraza => ({
  id, nombre: id.toUpperCase(), direccion: 'x', distrito: '1',
  lat: 36.72, lon: -4.42, metros: 10, horizonte: new Array(180).fill(grados),
});
const terrazas = [t('a', 0), t('b', 89), t('c', 0)]; // despejada, tapada, despejada
const MEDIODIA = new Date('2026-06-21T12:00:00Z');
const NOCHE = new Date('2026-01-15T02:00:00Z');

test('estados y conteo a mediodía', () => {
  assert.deepEqual(estados(terrazas, MEDIODIA), ['sol', 'sombra', 'sol']);
  assert.equal(contarAlSol(terrazas, MEDIODIA), 2);
});

test('de noche no hay terrazas al sol', () => {
  assert.deepEqual(estados(terrazas, NOCHE), ['noche', 'noche', 'noche']);
  assert.equal(contarAlSol(terrazas, NOCHE), 0);
});

test('lista vacía', () => assert.equal(contarAlSol([], MEDIODIA), 0));

test('GeoJSON: [lon, lat], solo id/nombre/estado y sin horizonte', () => {
  const g = aGeoJSON(terrazas, estados(terrazas, MEDIODIA));
  assert.equal(g.features.length, 3);
  assert.deepEqual(g.features[1].geometry.coordinates, [-4.42, 36.72]);
  assert.deepEqual(g.features[1].properties, { id: 'b', nombre: 'B', estado: 'sombra' });
  assert.ok(!JSON.stringify(g).includes('horizonte'));
});
