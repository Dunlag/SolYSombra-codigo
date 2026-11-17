import { test } from 'node:test';
import assert from 'node:assert/strict';
import barriosJson from '../data/barrios.json' with { type: 'json' };
import terrazasJson from '../data/terrazas.json' with { type: 'json' };
import { ZONAS, resolverZonas } from './alias.ts';
import type { Barrio } from './buscar.ts';
import type { Terraza } from './terrazas.ts';

const B = barriosJson as Barrio[], T = terrazasJson as Terraza[];

test('todos los barrios de la tabla de alias existen en barrios.json', () => {
  const nombres = new Set(B.map((b) => b.nombre));
  for (const z of ZONAS) for (const n of z.barrios ?? []) assert.ok(nombres.has(n), `${z.id}: barrio inexistente «${n}»`);
});

test('cada zona definida resuelve con >=1 terraza y ids existentes', () => {
  const zonas = resolverZonas(ZONAS, B, T);
  assert.deepEqual(zonas.map((z) => z.id), ZONAS.map((z) => z.id)); // ninguna descartada
  const ids = new Set(T.map((t) => t.id));
  for (const z of zonas) {
    assert.ok(z.terrazas.length >= 1, z.id);
    assert.ok(z.geometrias.length >= 1, z.id);
    assert.ok(z.terrazas.every((i) => ids.has(i)), z.id);
  }
});

test('los 11 distritos cubren todas las terrazas exactamente una vez', () => {
  const d = resolverZonas(ZONAS, B, T).filter((z) => /^d\d+$/.test(z.id));
  assert.equal(d.length, 11);
  assert.equal(d.reduce((n, z) => n + z.terrazas.length, 0), T.length);
});

test('alias de un solo barrio apunta a ese barrio; Soho es una caja con locales dentro', () => {
  const zonas = resolverZonas(ZONAS, B, T);
  const casco = zonas.find((z) => z.id === 'casco')!;
  assert.equal(B[casco.barrio!].nombre, 'CENTRO HISTORICO');
  const soho = zonas.find((z) => z.id === 'soho')!;
  assert.equal(soho.barrio, undefined);
  assert.deepEqual(soho.bbox, [-4.4265, 36.712, -4.4195, 36.7175]);
  const dentro = new Set(soho.terrazas);
  assert.ok(T.filter((t) => dentro.has(t.id)).every((t) => t.lon >= -4.4265 && t.lon <= -4.4195 && t.lat >= 36.712 && t.lat <= 36.7175));
});

test('un barrio a caballo se asigna a su distrito más frecuente; resolver ignora nombres inexistentes', () => {
  const b = (nombre: string, ids: string[]): Barrio => ({ id: nombre, nombre, bbox: [0, 0, 1, 1], geometria: { type: 'Polygon', coordinates: [] }, terrazas: ids });
  const t = (id: string, distrito: string, lon = 0.5) => ({ id, distrito, lon, lat: 0.5 }) as Terraza;
  const z = resolverZonas([{ id: 'x', nombre: 'X', distrito: '2' }, { id: 'y', nombre: 'Y', barrios: ['NO EXISTE'] }],
    [b('A', ['1', '2', '3'])], [t('1', '2'), t('2', '2'), t('3', '1')]);
  assert.equal(z.length, 1);
  assert.deepEqual(z[0].terrazas, ['1', '2']); // locales = distrito 2; contorno = barrio A (mayoría 2)
});
