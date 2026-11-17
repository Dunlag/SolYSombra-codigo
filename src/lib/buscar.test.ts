import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, buscarBarrios, buscarTodo, normalizar, type Barrio } from './buscar.ts';
import type { Zona } from './alias.ts';
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

const b = (nombre: string, n = 1): Barrio => ({ id: nombre, nombre, bbox: [0, 0, 1, 1], geometria: { type: 'Polygon', coordinates: [] }, terrazas: Array(n).fill('x') });
const B = [b('LA MALAGUETA'), b('EL PALO'), b('PLAYAS DEL PALO'), b('CIUDAD JARDÍN')];

test('barrios: insensible a acentos, exacto antes que prefijo antes que contiene', () => {
  assert.deepEqual(buscarBarrios(B, 'ciudad jardin'), [3]);
  assert.deepEqual(buscarBarrios(B, 'palo'), [1, 2]); // 'playas del palo' solo lo contiene
  assert.deepEqual(buscarBarrios([b('LA CA?ADA'), b('OTRO')], 'cañada'), [0]); // '?' comodín
});
test('barrio exacto va antes que los locales; el parcial, después', () => {
  const L = [...T, t('e', 'MALAGUETA BEACH'), t('f', 'PALO SANTO')];
  assert.deepEqual(buscarTodo(L, B, 'malagueta'), [{ tipo: 'barrio', i: 0 }, { tipo: 'local', i: 4 }]);
  assert.deepEqual(buscarTodo(L, B, 'palo').map((r) => r.tipo), ['barrio', 'local', 'barrio']);
  assert.deepEqual(buscarTodo(L, B, 'p'), []);
});

const z = (nombre: string, alias: string[] = [], barrio?: number, n = 2): Zona =>
  ({ id: nombre, nombre, nombreEn: nombre, alias, bbox: [0, 0, 1, 1], geometrias: [], terrazas: Array(n).fill('x'), barrio });
test('zonas: por alias (insensible a acentos), exacta antes que locales', () => {
  const Z = [z('Soho', ['Barrio de las Artes']), z('Distrito Centro')];
  assert.deepEqual(buscarTodo(T, B, 'soho', 8, Z), [{ tipo: 'zona', i: 0 }]);
  assert.deepEqual(buscarTodo(T, B, 'BARRIO DE LAS ARTÉS'.replace('É', 'E'), 8, Z), [{ tipo: 'zona', i: 0 }]);
  assert.deepEqual(buscarTodo([t('s', 'SOHO CAFE'), ...T], B, 'soho', 8, Z).map((r) => r.tipo), ['zona', 'local']);
});
test('alias de un barrio real: sale ese barrio una sola vez, sin zona duplicada', () => {
  const Z = [z('Centro histórico', ['Old Town'], 3)]; // apunta a B[3] = CIUDAD JARDÍN (solo para el test)
  assert.deepEqual(buscarTodo([], B, 'old town', 8, Z), [{ tipo: 'barrio', i: 3 }]);
  assert.deepEqual(buscarTodo([], B, 'ciudad jardin', 8, Z), [{ tipo: 'barrio', i: 3 }]);
});
test("zonas: '?' es comodín en la consulta contra el dato", () => assert.deepEqual(buscarTodo([], [], 'bailén', 8, [z('Distrito Bail?n')]), [{ tipo: 'zona', i: 0 }]));
