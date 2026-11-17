import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, normalizar } from './buscar.ts';
import type { Terraza } from './terrazas.ts';

const t = (id: string, nombre: string, direccion = 'CALLE X'): Terraza =>
  ({ id, nombre, direccion, distrito: '1', lat: 0, lon: 0, metros: 1, horizonte: [] });
const T = [t('a', 'BAR LA CA?A'), t('b', 'Cañas y Tapas'), t('c', 'OTRO', 'PLAZA DE LA CONSTITUCIÓN'), t('d', 'CAFÉ CENTRAL')];

test('normalizar quita acentos y mayúsculas', () => assert.equal(normalizar('CAÑÓN Él'), 'canon el'));
test('insensible a mayúsculas y acentos', () => assert.deepEqual(buscar(T, 'cafe'), [3]));
test("'?' del dato es comodín de un carácter", () => assert.deepEqual(buscar(T, 'caña'), [1, 0]));
test('busca en la dirección', () => assert.deepEqual(buscar(T, 'constitucion'), [2]));
test('nombre que empieza por la consulta va antes', () => assert.deepEqual(buscar(T, 'ca'), [1, 3, 0]));
test('menos de 2 caracteres o sin coincidencia: vacío', () => {
  assert.deepEqual(buscar(T, 'c'), []);
  assert.deepEqual(buscar(T, 'zzz'), []);
});
test('respeta el máximo', () => assert.equal(buscar(T, 'ca', 2).length, 2));
