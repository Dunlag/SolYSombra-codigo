import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convergencia, dentro, horizonte, puntoMuestreo, crearIndice, type Edificio, type Punto } from './geometria.ts';

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

test('convergencia EPSG:25830: cero central y signo conocido al oeste de -3°', () => {
  assert.equal(convergencia(36.72, -3), 0);
  // Referencia independiente: PROJ / GRS80 get_factors(-4.42, 36.72).
  assert.ok(Math.abs(convergencia(36.72, -4.42) - (-0.8491382330927506)) < 0.00001);
  assert.ok(convergencia(36.72, -4.42) < 0);
  assert.equal(convergencia(36.72, -1.58), -convergencia(36.72, -4.42));
});

test('horizonte: muro al norte de cuadrícula aparece a gamma del norte verdadero', () => {
  const muro: Edificio = { anillo: cuadrado(-0.3, 10, 0.3, 10.01), altura: 10 };
  const gamma = convergencia(36.72, -4.42);
  const sinRotar = horizonte([0, 0], [muro]);
  const h = horizonte([0, 0], [muro], gamma);
  assert.equal(sinRotar[0], 45);
  assert.equal(sinRotar[179], 45);
  assert.equal(h[0], 0);
  assert.equal(h[179], 45);
  const maximo = h.indexOf(Math.max(...h));
  const centro = (maximo + 0.5) * 2;
  // gamma = -0,849° => 359,151°: la franja cuyo centro es 359°, no 1°.
  assert.ok(Math.abs(centro - (360 + gamma)) < 1);
});

test('puntoMuestreo: separación configurable conserva 3 m por defecto y permite 8 m', () => {
  const a: Edificio = { anillo: cuadrado(0, 0, 10, 10), altura: 9 };
  assert.deepEqual(puntoMuestreo([5, 1], [a]), [5, -3]);
  assert.deepEqual(puntoMuestreo([5, 1], [a], 8), [5, -8]);
  for (const metros of [0, -1, NaN, Infinity]) {
    assert.throws(() => puntoMuestreo([5, 1], [a], metros), /mayor que 0/);
  }
});
