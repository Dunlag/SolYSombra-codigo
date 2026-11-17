import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aTerraza } from './terraza.ts';
import { convergencia, crearIndice, horizonte, type Edificio } from './geometria.ts';

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
  assert.equal(aTerraza(registro({ y: '' }), sinEdificios), 'sin-datos');
  assert.equal(aTerraza({ ...registro({}), geometry: null }, sinEdificios), 'sin-datos');
});

test('el horizonte consulta edificios alcanzables solo desde el punto desplazado', () => {
  const local: Edificio = { anillo: [[150, 0], [170, 0], [170, 20], [150, 20]], altura: 9 };
  const oeste: Edificio = { anillo: [[-2, -20], [-1, -20], [-1, 40], [-2, 40]], altura: 20 };
  const cerca = crearIndice([local, oeste]);
  assert.ok(!cerca([150.5, 10]).includes(oeste));
  assert.ok(cerca([147, 10]).includes(oeste));
  const t = aTerraza(registro({ x: 150.5, y: 10 }), cerca);
  assert.ok(typeof t !== 'string');
  assert.ok(t.horizonte[135] > 0);
  assert.deepEqual(t.horizonte, horizonte([147, 10], cerca([147, 10]), convergencia(t.lat, t.lon)));
});

test('aTerraza aplica convergencia por coordenadas geográficas', () => {
  const muro: Edificio = { anillo: [[-0.3, 10], [0.3, 10], [0.3, 10.01], [-0.3, 10.01]], altura: 10 };
  const t = aTerraza(registro({ x: 0, y: 0 }), () => [muro]);
  assert.ok(typeof t !== 'string');
  assert.equal(t.horizonte[0], 0);
  assert.equal(t.horizonte[179], 45);
});

test('los signos de interrogación del origen se conservan sin inventar tildes', () => {
  const t = aTerraza(registro({ nombre_lugar: 'PACO JOS?', direccion_actividad: 'CERVECER?A' }), sinEdificios);
  assert.ok(typeof t !== 'string');
  assert.equal(t.nombre, 'PACO JOS?');
  assert.equal(t.direccion, 'CALLE CERVECER?A 18');
});


test('aTerraza propaga la separación de la variante al horizonte', () => {
  const local: Edificio = { anillo: [[0, 0], [10, 0], [10, 10], [0, 10]], altura: 9 };
  const f = registro({ x: 5, y: 1 });
  const t3 = aTerraza(f, () => [local]);
  const t8 = aTerraza(f, () => [local], 8);
  assert.ok(typeof t3 !== 'string' && typeof t8 !== 'string');
  assert.ok(t8.horizonte[0] < t3.horizonte[0]);
  assert.deepEqual(t8.horizonte, horizonte([5, -8], [local], convergencia(t8.lat, t8.lon)));
});
