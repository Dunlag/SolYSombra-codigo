import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { enEclipse } from './eclipse.ts';

// Hora local de Madrid (CEST, UTC+2) del 2-ago-2027.
const m = (hm: string, dia = '2027-08-02') => new Date(`${dia}T${hm}:00+02:00`);

test('otro día = null, aunque sea la misma hora', () => {
  for (const d of ['2027-08-01', '2027-08-03', '2026-08-02']) assert.equal(enEclipse(m('10:48', d)), null);
});

test('bordes de cada tramo', () => {
  const casos: [string, ReturnType<typeof enEclipse>][] = [
    ['09:40', null], ['09:41', 'parcial'], ['10:44', 'parcial'],
    ['10:45', 'total'], ['10:49', 'total'], ['10:50', 'parcial'], ['10:54', 'parcial'],
    ['10:55', 'fin'], ['12:00', 'fin'], ['12:02', 'fin'], ['12:03', null], ['12:05', null],
  ];
  for (const [h, f] of casos) assert.equal(enEclipse(m(h)), f, h);
  assert.equal(enEclipse(new Date('2027-08-02T08:49:59.999Z')), 'total');
  assert.equal(enEclipse(new Date('2027-08-02T08:50:00Z')), 'parcial');
});

test('no depende de la zona horaria del proceso', () => {
  const src = `import { enEclipse } from ${JSON.stringify(import.meta.resolve('./eclipse.ts'))};
    console.log(['2027-08-02T10:47:00+02:00','2027-08-02T09:00:00+02:00','2027-08-02T20:47:00+12:00'].map((s) => String(enEclipse(new Date(s)))).join());`;
  for (const TZ of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(r.stdout.trim(), 'total,null,total', TZ + r.stderr);
  }
});
