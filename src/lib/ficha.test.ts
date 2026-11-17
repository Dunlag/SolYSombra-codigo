import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const { tramoActual, lineaDia, enlaceMapas, siguienteNivel, nivelMasCercano } = await import('./ficha.ts');

const base = { id: 'x', nombre: 'T', direccion: 'd', distrito: 'c', lat: 36.72, lon: -4.42, metros: 0 };
const plano = (g: number) => ({ ...base, horizonte: new Array(180).fill(g) });
const hh = (d: Date | null) => d && d.getUTCHours() + d.getUTCMinutes() / 60;

test('horizonte plano de día: sol hasta la puesta, luego noche', () => {
  const r = tramoActual(plano(0), new Date('2026-06-21T10:00:00Z'));
  assert.equal(r.estado, 'sol');
  assert.equal(r.siguiente, 'noche');
  assert.ok(hh(r.hasta)! > 18.5 && hh(r.hasta)! < 20, `puesta ${r.hasta?.toISOString()}`);
});

test('horizonte tapado: sombra hasta la puesta', () => {
  const r = tramoActual(plano(89), new Date('2026-06-21T10:00:00Z'));
  assert.equal(r.estado, 'sombra');
  assert.equal(r.siguiente, 'noche');
});

test('transición sol -> sombra con horizonte sintético (oeste tapado)', () => {
  const h = new Array(180).fill(0).map((_, i) => (i >= 90 ? 89 : 0)); // azimut 180-360° tapado
  const r = tramoActual({ ...base, horizonte: h }, new Date('2026-06-21T10:00:00Z'));
  assert.equal(r.estado, 'sol');
  assert.equal(r.siguiente, 'sombra');
  assert.ok(hh(r.hasta)! > 11.9 && hh(r.hasta)! < 12.6, `cruce sur ${r.hasta?.toISOString()}`);
});

test('noche: termina al amanecer', () => {
  const r = tramoActual(plano(0), new Date('2026-01-15T02:00:00Z'));
  assert.equal(r.estado, 'noche');
  assert.equal(r.siguiente, 'sol');
  assert.ok(hh(r.hasta)! > 6 && hh(r.hasta)! < 8);
});

test('noche hasta medianoche sin cambio: hasta=null', () => {
  const r = tramoActual(plano(0), new Date('2026-01-15T21:00:00Z')); // 22:00 locales
  assert.deepEqual(r, { estado: 'noche', hasta: null, siguiente: null });
});

test('lineaDia: 48 franjas, noche en los extremos y sol a mediodía', () => {
  const l = lineaDia(plano(0), new Date('2026-06-21T10:00:00Z'));
  assert.equal(l.length, 48);
  assert.equal(l[0], 'noche');
  assert.equal(l[26], 'sol'); // 13:00-13:30 local
});

test('enlaceMapas busca por nombre y dirección; con "?" roto usa coordenadas', () => {
  const u = new URL(enlaceMapas({ ...base, nombre: 'CAFE NEGRO', direccion: 'CL ALCAZABILLA 9' }));
  assert.equal(u.protocol, 'https:');
  assert.equal(u.searchParams.get('query'), 'CAFE NEGRO, CL ALCAZABILLA 9, Málaga');
  assert.equal(new URL(enlaceMapas({ ...base, nombre: 'CAFETER?A' })).searchParams.get('query'), '36.72,-4.42');
});

test('niveles: ciclo e imán', () => {
  assert.equal(siguienteNivel(2), 0);
  assert.equal(nivelMasCercano(210, [200, 540, 800]), 0);
  assert.equal(nivelMasCercano(400, [200, 540, 800]), 1);
  assert.equal(nivelMasCercano(790, [200, 540, 800]), 2);
});

// PORQUÉ un proceso hijo: la TZ de Node se fija al arrancar, así que para probar "otra zona" hay que
// lanzar otro proceso. El resultado (tramo y línea del día) debe ser idéntico en cualquier zona del móvil.
test('el resultado no depende de la zona horaria del dispositivo', () => {
  const script = `
    const { tramoActual, lineaDia } = await import(${JSON.stringify(import.meta.resolve('./ficha.ts'))});
    const t = { id: 'x', nombre: 'T', direccion: 'd', distrito: 'c', lat: 36.72, lon: -4.42, metros: 0, horizonte: new Array(180).fill(0) };
    console.log(JSON.stringify([
      tramoActual(t, new Date('2026-01-15T21:00:00Z')),  // 22:00 Madrid: sin cambios hasta medianoche
      tramoActual(t, new Date('2026-06-21T10:00:00Z')),  // 12:00 Madrid: sol hasta la puesta
      lineaDia(t, new Date('2026-06-21T10:00:00Z')),
      lineaDia(t, new Date('2026-03-29T10:00:00Z')),     // día de cambio de hora (23 h)
    ]));`;
  const salida = (TZ: string) => execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
  const madrid = salida('Europe/Madrid');
  assert.equal(salida('Asia/Tokyo'), madrid);
  assert.equal(salida('America/New_York'), madrid);
  assert.equal(JSON.parse(madrid)[0].hasta, null);
});
