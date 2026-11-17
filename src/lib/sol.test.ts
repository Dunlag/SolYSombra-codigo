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

test('eclipse 2027-08-02: totalidad = sombra en todas las rutas; el día anterior/posterior no cambia', async () => {
  const { tramoActual, lineaDia } = await import('./ficha.ts');
  const t = { horizonte: plano(0), lat: LAT, lon: LON } as Parameters<typeof tramoActual>[0];
  const total = new Date('2027-08-02T10:45:00+02:00');
  assert.equal(estaAlSol(plano(0), LAT, LON, total), 'sombra');
  assert.equal(tramoActual(t, total).estado, 'sombra');
  assert.equal(tramoActual(t, total).hasta?.toISOString(), '2027-08-02T08:50:00.000Z'); // vuelve el sol a las 10:50
  assert.equal(lineaDia(t, total)[21], 'sombra'); // franja 10:30-11:00, medida a las 10:45
  for (const d of ['2027-08-01', '2027-08-03']) assert.equal(estaAlSol(plano(0), LAT, LON, new Date(`${d}T10:48:00+02:00`)), 'sol');
});
