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
