import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { rutasExportacion, separacionExportacion } from './exportar.ts';

const raiz = resolve(import.meta.dirname, '..');

test('exportar: rutas por defecto independientes del cwd', () => {
  assert.deepEqual(rutasExportacion(''), {
    raw: join(raiz, 'pipeline/raw'),
    salida: join(raiz, 'src/data/terrazas.json'),
  });
  const cwd = process.cwd();
  try {
    process.chdir(tmpdir());
    assert.equal(rutasExportacion('').raw, join(raiz, 'pipeline/raw'));
    assert.equal(rutasExportacion('').salida, join(raiz, 'src/data/terrazas.json'));
  } finally {
    process.chdir(cwd);
  }
});

test('exportar: SS_SALIDA permite salida temporal absoluta o relativa al repositorio', () => {
  const destino = join(tmpdir(), 'solysombra-prueba', 'terrazas.json');
  const anterior = process.env.SS_SALIDA;
  try {
    process.env.SS_SALIDA = destino;
    assert.equal(rutasExportacion().salida, destino);
  } finally {
    if (anterior === undefined) delete process.env.SS_SALIDA;
    else process.env.SS_SALIDA = anterior;
  }
  assert.equal(rutasExportacion('salida/terrazas.json').salida, join(raiz, 'salida/terrazas.json'));
});

test('exportar: SS_SEPARACION positiva y finita, 3 m por defecto', () => {
  const anterior = process.env.SS_SEPARACION;
  try {
    delete process.env.SS_SEPARACION;
    assert.equal(separacionExportacion(), 3);
    process.env.SS_SEPARACION = '8';
    assert.equal(separacionExportacion(), 8);
    assert.equal(separacionExportacion('2.5'), 2.5);
    for (const valor of ['', ' ', '0', '-2', 'NaN', 'Infinity', 'ocho', '8m']) {
      assert.throws(() => separacionExportacion(valor), /SS_SEPARACION/);
    }
  } finally {
    if (anterior === undefined) delete process.env.SS_SEPARACION;
    else process.env.SS_SEPARACION = anterior;
  }
});
