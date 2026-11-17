import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { consultarHoras, DATOS, fechaMadrid, formatearHoras, rejillaMadrid, validarFecha } from './horas.ts';
import type { Terraza } from './terraza.ts';

const terraza: Terraza = {
  id: 'prueba', nombre: 'CAFÉ PRUEBA', direccion: 'CL ÚNICA 1', distrito: '1',
  lat: 36.72, lon: -4.42, metros: 10, horizonte: Array(180).fill(0),
};

test('fecha por defecto de Madrid en los dos lados de medianoche UTC', () => {
  assert.equal(fechaMadrid(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
  assert.equal(fechaMadrid(new Date('2026-01-01T23:30:00Z')), '2026-01-02');
  assert.equal(fechaMadrid(new Date('2026-07-01T21:30:00Z')), '2026-07-01');
});

test('valida formato, días reales y años bisiestos sin normalizar fechas inválidas', () => {
  for (const fecha of ['2024-02-29', '2026-01-01', '2000-02-29']) assert.doesNotThrow(() => validarFecha(fecha));
  for (const fecha of ['2026-02-29', '2026-04-31', '1900-02-29', '2026-00-10', '2026-13-10', '2026-1-01', '0000-01-01', 'ayer', '']) {
    assert.throws(() => validarFecha(fecha), /Fecha inválida.*AAAA-MM-DD/);
  }
});

test('rejilla inclusiva de 11:00 a 19:00 en invierno, verano y cambios estacionales', () => {
  for (const [fecha, inicio, fin] of [
    ['2026-01-10', '10:00', '18:00'], ['2026-07-10', '09:00', '17:00'],
    ['2026-03-29', '09:00', '17:00'], ['2026-10-25', '10:00', '18:00'],
  ]) {
    const rejilla = rejillaMadrid(fecha);
    assert.equal(rejilla.length, 17);
    assert.equal(rejilla[0].toISOString(), `${fecha}T${inicio}:00.000Z`);
    assert.equal(rejilla.at(-1)!.toISOString(), `${fecha}T${fin}:00.000Z`);
    assert.ok(rejilla.slice(1).every((d, i) => d.getTime() - rejilla[i].getTime() === 1800000));
  }
});

test('salida con cabecera, 17 horas y estados, incluida noche para no perder filas', () => {
  const salida = formatearHoras(terraza, '2026-12-21').split('\n');
  assert.equal(salida[1], 'CAFÉ PRUEBA — CL ÚNICA 1 (prueba) — 2026-12-21');
  assert.equal(salida.length, 19);
  assert.equal(salida[2], '  11:00  sol');
  assert.equal(salida.at(-1), '  19:00  noche');
});

test('búsqueda única por nombre o calle, sin resultado y ambigua con listado', () => {
  assert.equal(consultarHoras([terraza], 'café', '2026-07-10'), formatearHoras(terraza, '2026-07-10'));
  assert.equal(consultarHoras([terraza], ' única ', '2026-07-10'), formatearHoras(terraza, '2026-07-10'));
  assert.throws(() => consultarHoras([terraza], 'ausente'), /No se encontró ninguna terraza/);
  const otra = { ...terraza, id: 'otra', nombre: 'OTRA', direccion: 'CL ÚNICA 2' };
  assert.throws(() => consultarHoras([terraza, otra], 'única'), (error: Error) => {
    assert.match(error.message, /Se encontraron 2 terrazas/);
    assert.match(error.message, /CAFÉ PRUEBA — CL ÚNICA 1 \(prueba\)/);
    assert.match(error.message, /OTRA — CL ÚNICA 2 \(otra\)/);
    return true;
  });
  assert.throws(() => consultarHoras([terraza], '  '), /Uso:/);
});

test('fecha, rejilla y salida idénticas con TZ por defecto, Tokyo y New York desde otro cwd', () => {
  const codigo = `import { fechaMadrid, rejillaMadrid, formatearHoras, DATOS } from ${JSON.stringify(new URL('./horas.ts', import.meta.url).href)};
    console.log(JSON.stringify({ datos: DATOS, fecha: fechaMadrid(new Date('2026-07-01T22:30:00Z')),
      casos: ['2026-01-10','2026-07-10','2026-03-29','2026-10-25'].map(f => ({
        rejilla: rejillaMadrid(f), salida: formatearHoras(${JSON.stringify(terraza)}, f) })) }));`;
  const resultados = [undefined, 'Asia/Tokyo', 'America/New_York'].map((TZ) => {
    const proceso = spawnSync(process.execPath, ['--input-type=module', '--eval', codigo], {
      cwd: tmpdir(), env: { ...process.env, ...(TZ ? { TZ } : {}) }, encoding: 'utf8',
    });
    assert.ifError(proceso.error);
    assert.equal(proceso.status, 0, proceso.stderr);
    return proceso.stdout;
  });
  assert.equal(resultados[0], resultados[1]);
  assert.equal(resultados[0], resultados[2]);
  assert.equal(JSON.parse(resultados[0]).datos, DATOS);
});

test('CLI devuelve código no cero para uso incorrecto, fecha inválida, cero o varias coincidencias', () => {
  for (const [argumentos, mensaje] of [
    [[], /Uso:/], [['imposible-ninguna-terraza-123456789'], /No se encontró/],
    [['CAFE', '2026-02-30'], /Fecha inválida/], [['CL', '2026-07-10'], /Se encontraron \d+ terrazas/],
  ] as const) {
    const proceso = spawnSync(process.execPath, [fileURLToPath(new URL('./horas.ts', import.meta.url)), ...argumentos], {
      cwd: tmpdir(), encoding: 'utf8',
    });
    assert.ifError(proceso.error);
    assert.equal(proceso.status, 1, proceso.stderr);
    assert.match(proceso.stderr, mensaje);
    assert.equal(proceso.stdout, '');
  }
});
