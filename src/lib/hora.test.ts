import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aFecha, ajustar, ahora, aISO, conDiaISO, etiquetaFecha, manana, masUnaHora, minutosDelDia,
  normalizarHistograma, relativa, tarde, textoHora,
} from './hora.ts';

// 2026-11-16 es lunes; en noviembre Madrid va en UTC+1.
const lun13 = new Date('2026-11-16T12:40:00Z'); // 13:40 Madrid

test('minutosDelDia usa hora de Madrid, no la del equipo', () => {
  assert.equal(minutosDelDia(lun13), 13 * 60 + 40);
  assert.equal(minutosDelDia(new Date('2026-07-01T12:00:00Z')), 14 * 60); // verano UTC+2
});

test('aFecha limita al rango y redondea al paso', () => {
  assert.equal(minutosDelDia(aFecha(lun13, 7 * 60)), 8 * 60);
  assert.equal(minutosDelDia(aFecha(lun13, 23 * 60)), 22 * 60);
  assert.equal(minutosDelDia(aFecha(lun13, 13 * 60 + 12)), 13 * 60 + 10);
  assert.equal(aFecha(lun13, 14 * 60).toISOString(), '2026-11-16T13:00:00.000Z');
});

test('ajustar redondea (con segundos) y ahora() de noche cae en 22:00', () => {
  assert.equal(textoHora(minutosDelDia(ajustar(new Date('2026-11-16T12:42:31Z')))), '13:45');
  assert.equal(textoHora(minutosDelDia(ahora(new Date('2026-11-16T21:30:00Z')))), '22:00'); // 22:30 Madrid
  assert.equal(textoHora(minutosDelDia(ahora(new Date('2026-11-16T23:30:00Z')))), '08:00'); // 00:30 Madrid, antes del rango
});

test('masUnaHora suma 60 min con tope en 22:00', () => {
  assert.equal(textoHora(minutosDelDia(masUnaHora(lun13))), '14:40');
  assert.equal(textoHora(minutosDelDia(masUnaHora(aFecha(lun13, 21 * 60 + 30)))), '22:00');
});

test('tarde = 17:00 del mismo día', () => {
  const t = tarde(lun13);
  assert.equal(textoHora(minutosDelDia(t)), '17:00');
  assert.equal(aISO(t), '2026-11-16');
});

test('manana conserva la hora y suma un día', () => {
  const m = manana(lun13);
  assert.equal(aISO(m), '2026-11-17');
  assert.equal(textoHora(minutosDelDia(m)), '13:40');
});

test('manana cruza el cambio de hora de octubre (día de 25 h) y marzo (23 h)', () => {
  const sab = new Date('2026-10-24T15:00:00Z'); // 17:00 Madrid (CEST, +2)
  const dom = manana(sab);
  assert.equal(aISO(dom), '2026-10-25');
  assert.equal(minutosDelDia(dom), 17 * 60);
  assert.equal(dom.toISOString(), '2026-10-25T16:00:00.000Z'); // ya +1
  const sig = manana(dom);
  assert.equal(sig.toISOString(), '2026-10-26T16:00:00.000Z');

  const sab2 = new Date('2026-03-28T16:00:00Z'); // 17:00 Madrid (CET, +1)
  const dom2 = manana(sab2);
  assert.equal(minutosDelDia(dom2), 17 * 60);
  assert.equal(dom2.toISOString(), '2026-03-29T15:00:00.000Z'); // ya +2
});

test('relativa: ahora / hoy / manana / null', () => {
  const reloj = new Date('2026-11-16T12:41:00Z');
  assert.equal(relativa(ahora(reloj), reloj), 'ahora');
  assert.equal(relativa(tarde(reloj), reloj), 'hoy');
  assert.equal(relativa(manana(reloj), reloj), 'manana');
  assert.equal(relativa(conDiaISO(reloj, '2026-11-20')!, reloj), null);
});

test('etiquetaFecha por idioma, en hora de Madrid', () => {
  assert.equal(etiquetaFecha(lun13, 'es'), 'lun 16 nov');
  assert.equal(etiquetaFecha(lun13, 'en'), 'Mon 16 Nov');
  // 23:30 UTC del domingo ya es lunes en Madrid
  assert.equal(etiquetaFecha(new Date('2026-11-15T23:30:00Z'), 'es'), 'lun 16 nov');
});

test('conDiaISO cambia el día y mantiene la hora; rechaza basura', () => {
  const f = conDiaISO(lun13, '2026-12-25')!;
  assert.equal(aISO(f), '2026-12-25');
  assert.equal(textoHora(minutosDelDia(f)), '13:40');
  assert.equal(conDiaISO(lun13, ''), null);
});

test('normalizarHistograma', () => {
  assert.deepEqual(normalizarHistograma([0, 5, 10]), [0, 0.5, 1]);
  assert.deepEqual(normalizarHistograma([0, 0]), [0, 0]);
  assert.deepEqual(normalizarHistograma([]), []);
});
