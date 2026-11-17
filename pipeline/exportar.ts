import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { leerEdificios } from './catastro.ts';
import { crearIndice } from './geometria.ts';
import { aTerraza, type Terraza } from './terraza.ts';

export function rutasExportacion(salida = process.env.SS_SALIDA) {
  // Anclar también las rutas relativas al repositorio permite ejecutar desde cron o /tmp.
  const raiz = resolve(import.meta.dirname, '..');
  return {
    raw: resolve(raiz, 'pipeline/raw'),
    salida: resolve(raiz, salida || 'src/data/terrazas.json'),
  };
}

export function separacionExportacion(valor = process.env.SS_SEPARACION): number {
  const metros = valor === undefined ? 3 : Number(valor);
  // Validar antes de leer el GML evita gastar minutos de cálculo para una variante mal configurada.
  if (!Number.isFinite(metros) || metros <= 0) throw new Error('SS_SEPARACION debe ser un número mayor que 0.');
  return metros;
}

export async function exportar() {
  const separacion = separacionExportacion();
  const { raw: RAW, salida } = rutasExportacion();
  const edificios = await leerEdificios(`${RAW}/A.ES.SDGC.BU.29900.buildingpart.gml`);
  const cerca = crearIndice(edificios);
  const { features } = JSON.parse(readFileSync(`${RAW}/terrazas.geojson`, 'utf8'));

  const terrazas: Terraza[] = [];
  const ids = new Map<string, number>();
  const cuenta = { 'sin-datos': 0, 'sin-punto': 0 };
  for (const f of features) {
    const t = aTerraza(f, cerca, separacion);
    if (typeof t === 'string') { cuenta[t]++; continue; }
    const n = (ids.get(t.id) ?? 0) + 1;
    ids.set(t.id, n);
    if (n > 1) t.id += `-${n}`;
    terrazas.push(t);
  }

  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, JSON.stringify(terrazas));

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
}

// Importar las rutas en los tests no debe disparar una exportación sobre el dato publicado.
if (import.meta.main) await exportar();
