import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { leerEdificios } from './catastro.ts';
import { crearIndice } from './geometria.ts';
import { aTerraza, type Terraza } from './terraza.ts';

const RAW = 'pipeline/raw';
const edificios = await leerEdificios(`${RAW}/A.ES.SDGC.BU.29900.buildingpart.gml`);
const cerca = crearIndice(edificios);
const { features } = JSON.parse(readFileSync(`${RAW}/terrazas.geojson`, 'utf8'));

const terrazas: Terraza[] = [];
const ids = new Map<string, number>();
const cuenta = { 'sin-datos': 0, 'sin-punto': 0 };
for (const f of features) {
  const t = aTerraza(f, cerca);
  if (typeof t === 'string') { cuenta[t]++; continue; }
  const n = (ids.get(t.id) ?? 0) + 1;
  ids.set(t.id, n);
  if (n > 1) t.id += `-${n}`;
  terrazas.push(t);
}

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/terrazas.json', JSON.stringify(terrazas));

const media = (h: number[]) => h.reduce((a, b) => a + b, 0) / h.length;
console.log({
  edificios: edificios.length,
  registros: features.length,
  exportadas: terrazas.length,
  ...cuenta,
  despejadas: terrazas.filter((t) => media(t.horizonte) < 5).length,
  // sin ninguna dirección abierta: patio interior o punto mal sacado a la calle
  encerradas: terrazas.filter((t) => Math.min(...t.horizonte) > 30).length,
});
