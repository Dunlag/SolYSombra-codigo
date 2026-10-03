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
