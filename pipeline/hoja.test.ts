import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { CASOS, analizarTerraza, generarHoja, rutasHoja, separarVentanasBreves } from './hoja.ts';
import type { Terraza } from './terraza.ts';

const terraza = (id: string): Terraza => ({
  id, nombre: id, direccion: '', distrito: '', metros: 0, lat: 36.72, lon: -4.42, horizonte: Array(180).fill(0),
});

test('hoja: separa una ventana breve del cambio principal y conserva la noche', () => {
  const inicio = Date.parse('2026-11-28T15:49:51Z');
  const noche = { instante: inicio + 5000000, desde: 'sombra', hasta: 'noche' } as const;
  const cambios = [
    { instante: inicio - 1000000, desde: 'sol', hasta: 'sombra' },
    { instante: inicio, desde: 'sombra', hasta: 'sol' },
    { instante: inicio + 220000, desde: 'sol', hasta: 'sombra' },
    noche,
  ] as const;
  const resultado = separarVentanasBreves([...cambios]);
  assert.deepEqual(resultado.principales, [cambios[0], noche]);
  assert.deepEqual(resultado.breves, [{ inicio, fin: inicio + 220000 }]);
  assert.equal(separarVentanasBreves([
    { instante: inicio, desde: 'sombra', hasta: 'sol' },
    { instante: inicio + 300000, desde: 'sol', hasta: 'sombra' },
  ]).principales.length, 2);
});

test('hoja: 17 filas inclusivas, cambios acotados a 11–19 de Madrid y noche real de noviembre', () => {
  const a = analizarTerraza(terraza('x'), '2026-11-28');
  assert.equal(a.filas.length, 17);
  assert.deepEqual(a.filas[0], { hora: '11:00', estado: 'sol' });
  assert.deepEqual(a.filas.at(-1), { hora: '19:00', estado: 'noche' });
  assert.equal(a.principales.length, 1);
  assert.equal(a.principales[0].hasta, 'noche');
  const puesta = new Date(a.principales[0].instante);
  assert.equal(puesta.getUTCHours(), 17);
  assert.ok(puesta.getUTCMinutes() < 2);
});

test('hoja: genera las cinco secciones, los mapas y resultado vacío con ambas predicciones', () => {
  const datos = CASOS.map((c) => terraza(c.id));
  const doc = generarHoja(datos, datos, '2026-11-28');
  assert.match(doc, /sábado 28 de noviembre de 2026/);
  assert.match(doc, /3 m \(producción\)/);
  assert.match(doc, /menos de 30 minutos/);
  assert.match(doc, /el prototipo web puede seguir avanzando en paralelo/);
  assert.match(doc, /la publicación general espera a la validación de campo/);
  assert.match(doc, /## Resultado/);
  assert.equal(doc.match(/\| Hora \| Previsto 3 m \| Previsto 8 m \| Real \|/g)?.length, 5);
  assert.equal(doc.match(/\| 18:30 \| noche \| noche \| \|/g)?.length, 5);
  for (const caso of CASOS) assert.ok(doc.includes(`https://www.google.com/maps?q=${caso.mapa}`));
  assert.doesNotMatch(generarHoja(datos, datos, '2026-06-21'), /La noche empieza alrededor de las 18:00/);
  assert.throws(() => generarHoja([], datos, '2026-11-28'), /exactamente una terraza/);
  assert.throws(() => generarHoja(datos, [...datos, datos[0]], '2026-11-28'), /exactamente una terraza/);
  assert.throws(() => generarHoja(datos, datos, '2026-02-30'), /Fecha inválida/);
});

test('hoja: rutas independientes del cwd y fechas validadas', () => {
  const raiz = resolve(import.meta.dirname, '..'), cwd = process.cwd();
  try {
    process.chdir(tmpdir());
    assert.deepEqual(rutasHoja(), {
      fecha: '2026-11-28', tres: join(raiz, 'src/data/terrazas.json'),
      ocho: join(raiz, 'pipeline/raw/terrazas-8m.json'), salida: join(raiz, 'docs/validacion-campo.md'),
    });
    assert.equal(rutasHoja('2026-11-28', '/tmp/tres.json').tres, '/tmp/tres.json');
    assert.equal(rutasHoja('2026-11-28', 'tres.json').tres, join(raiz, 'tres.json'));
    assert.throws(() => rutasHoja('2026-13-01'), /Fecha inválida/);
  } finally { process.chdir(cwd); }
});
