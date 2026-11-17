import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const RAW = fileURLToPath(new URL('./raw/', import.meta.url));
export const GML = 'A.ES.SDGC.BU.29900.buildingpart.gml';
const TERRAZAS = 'https://datosabiertos.malaga.eu/recursos/comercio/establecimientos/da_ovpMesasPlanos-4326.geojson';
const EDIFICIOS = 'https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/29/29900-MALAGA/A.ES.SDGC.BU.29900.zip';

type Dependencias = {
  fetch: typeof fetch;
  ejecutar: (comando: string, argumentos: string[]) => unknown;
  log: (mensaje: string) => void;
};

export async function descargar(
  { raw = RAW, forzar = false }: { raw?: string; forzar?: boolean } = {},
  dependencias: Partial<Dependencias> = {},
): Promise<void> {
  const { fetch: obtener = fetch, ejecutar = execFileSync, log = console.log } = dependencias;
  const extraer = forzar || !existsSync(join(raw, GML));
  if (extraer) {
    try {
      ejecutar('unzip', ['-v']);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('No se encuentra unzip. En Arch/Omarchy instálalo con: sudo pacman -S unzip', { cause: error });
      }
      throw error;
    }
  }

  mkdirSync(raw, { recursive: true });
  async function bajar(url: string, destino: string) {
    if (!forzar && existsSync(destino)) return;
    const respuesta = await obtener(url);
    if (!respuesta.ok) throw new Error(`${respuesta.status} al descargar ${url}`);
    // Un fallo de descarga no debe dejar un archivo parcial que parezca una caché válida.
    const temporal = `${destino}.part`;
    try {
      writeFileSync(temporal, Buffer.from(await respuesta.arrayBuffer()));
      renameSync(temporal, destino);
    } finally {
      rmSync(temporal, { force: true });
    }
    log(`descargado ${destino}`);
  }

  await bajar(TERRAZAS, join(raw, 'terrazas.geojson'));
  if (extraer) {
    await bajar(EDIFICIOS, join(raw, 'edificios.zip'));
    ejecutar('unzip', ['-o', join(raw, 'edificios.zip'), '-d', raw]);
    if (!existsSync(join(raw, GML))) throw new Error(`La extracción no generó ${join(raw, GML)}. Revisa el ZIP del Catastro y reintenta con --forzar.`);
  }
}

if (import.meta.main) {
  try {
    const argumentos = process.argv.slice(2);
    if (argumentos.some((a) => a !== '--forzar')) throw new Error('Uso: npm run datos:descargar -- [--forzar]');
    await descargar({ forzar: argumentos.includes('--forzar') });
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
