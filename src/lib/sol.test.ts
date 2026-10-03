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
