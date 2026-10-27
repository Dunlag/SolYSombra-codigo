import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RAW = 'pipeline/raw';
const TERRAZAS = 'https://datosabiertos.malaga.eu/recursos/comercio/establecimientos/da_ovpMesasPlanos-4326.geojson';
const EDIFICIOS = 'https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/29/29900-MALAGA/A.ES.SDGC.BU.29900.zip';

async function bajar(url: string, destino: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} al descargar ${url}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log('descargado', destino);
}

mkdirSync(RAW, { recursive: true });
await bajar(TERRAZAS, `${RAW}/terrazas.geojson`);
await bajar(EDIFICIOS, `${RAW}/edificios.zip`);
execFileSync('unzip', ['-o', `${RAW}/edificios.zip`, '-d', RAW]);
