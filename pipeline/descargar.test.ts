import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { descargar, GML, RAW } from './descargar.ts';

function entorno(t: { after: (fn: () => void) => void }) {
  const raw = mkdtempSync(join(tmpdir(), 'solysombra-descargar-'));
  t.after(() => rmSync(raw, { recursive: true, force: true }));
  const urls: string[] = [];
  const comandos: string[][] = [];
  const dependencias = {
    fetch: (async (url: string) => {
      urls.push(url);
      return new Response('contenido nuevo');
    }) as typeof fetch,
    ejecutar: (comando: string, argumentos: string[]) => {
      comandos.push([comando, ...argumentos]);
      if (argumentos[0] === '-o') writeFileSync(join(raw, GML), 'extraído');
    },
    log: () => {},
  };
  return { raw, urls, comandos, dependencias };
}

test('rutas de raw absolutas y relativas al módulo', () => {
  assert.ok(isAbsolute(RAW));
  assert.equal(RAW, new URL('./raw/', import.meta.url).pathname);
});

test('descarga y extrae una vez; reutiliza todos los archivos al repetir', async (t) => {
  const e = entorno(t);
  await descargar({ raw: e.raw }, e.dependencias);
  assert.equal(e.urls.length, 3);
  assert.deepEqual(e.comandos, [
    ['unzip', '-v'], ['unzip', '-o', join(e.raw, 'edificios.zip'), '-d', e.raw],
  ]);
  assert.equal(readFileSync(join(e.raw, 'terrazas.geojson'), 'utf8'), 'contenido nuevo');
  await descargar({ raw: e.raw }, e.dependencias);
  assert.equal(e.urls.length, 3);
  assert.equal(e.comandos.length, 2);
});

test('GML y terrazas existentes bastan aunque no haya ZIP ni unzip', async (t) => {
  const e = entorno(t);
  writeFileSync(join(e.raw, GML), 'existente');
  writeFileSync(join(e.raw, 'terrazas.geojson'), 'existente');
  writeFileSync(join(e.raw, 'barrios.geojson'), 'existente');
  await descargar({ raw: e.raw }, {
    fetch: async () => { throw new Error('no debe descargar'); },
    ejecutar: () => { throw new Error('no debe ejecutar'); },
  });
  assert.equal(readFileSync(join(e.raw, GML), 'utf8'), 'existente');
});

test('ZIP existente y GML ausente: extrae sin descargar el ZIP', async (t) => {
  const e = entorno(t);
  writeFileSync(join(e.raw, 'edificios.zip'), 'ZIP existente');
  await descargar({ raw: e.raw }, e.dependencias);
  assert.equal(e.urls.length, 2);
  assert.match(e.urls[0], /geojson$/);
  assert.equal(readFileSync(join(e.raw, 'edificios.zip'), 'utf8'), 'ZIP existente');
  assert.ok(existsSync(join(e.raw, GML)));
});

test('--forzar reemplaza descargas y vuelve a extraer', async (t) => {
  const e = entorno(t);
  for (const archivo of [GML, 'terrazas.geojson', 'barrios.geojson', 'edificios.zip']) writeFileSync(join(e.raw, archivo), 'viejo');
  await descargar({ raw: e.raw, forzar: true }, e.dependencias);
  assert.equal(e.urls.length, 3);
  assert.equal(e.comandos.length, 2);
  assert.equal(readFileSync(join(e.raw, 'edificios.zip'), 'utf8'), 'contenido nuevo');
  assert.equal(readFileSync(join(e.raw, GML), 'utf8'), 'extraído');
});

test('unzip ausente da una instrucción de instalación antes de usar la red', async (t) => {
  const e = entorno(t);
  await assert.rejects(descargar({ raw: e.raw }, {
    ...e.dependencias,
    ejecutar: () => { throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }); },
  }), /No se encuentra unzip.*sudo pacman -S unzip/);
  assert.equal(e.urls.length, 0);
});

test('los errores de unzip distintos de ENOENT se conservan', async (t) => {
  const e = entorno(t);
  const error = new Error('ZIP corrupto');
  await assert.rejects(descargar({ raw: e.raw }, {
    ...e.dependencias,
    ejecutar: (_, args) => { if (args[0] === '-o') throw error; },
  }), (recibido) => recibido === error);
});

test('HTTP fallido no crea una caché válida', async (t) => {
  const e = entorno(t);
  await assert.rejects(descargar({ raw: e.raw }, {
    ...e.dependencias, fetch: async () => new Response('error', { status: 503 }),
  }), /503 al descargar/);
  assert.equal(existsSync(join(e.raw, 'terrazas.geojson')), false);
  assert.equal(existsSync(join(e.raw, 'terrazas.geojson.part')), false);
});

test('un cuerpo interrumpido conserva la caché anterior con --forzar', async (t) => {
  const e = entorno(t);
  writeFileSync(join(e.raw, 'terrazas.geojson'), 'anterior');
  await assert.rejects(descargar({ raw: e.raw, forzar: true }, {
    ...e.dependencias,
    fetch: async () => new Response(new ReadableStream({ start(c) { c.error(new Error('interrumpido')); } })),
  }), /interrumpido/);
  assert.equal(readFileSync(join(e.raw, 'terrazas.geojson'), 'utf8'), 'anterior');
  assert.equal(existsSync(join(e.raw, 'terrazas.geojson.part')), false);
});

test('una extracción sin el GML requerido informa del archivo ausente', async (t) => {
  const e = entorno(t);
  await assert.rejects(descargar({ raw: e.raw }, { ...e.dependencias, ejecutar: () => {} }), /extracción no generó.*buildingpart.gml.*--forzar/);
});
