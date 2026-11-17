import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estaAlSol } from '../src/lib/sol.ts';
import type { Terraza } from './terraza.ts';

export const DATOS = fileURLToPath(new URL('../src/data/terrazas.json', import.meta.url));
const ZONA = 'Europe/Madrid';
const calendario = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});
const reloj = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function fechaMadrid(ahora = new Date()): string {
  const partes = calendario.formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor('year').padStart(4, '0')}-${valor('month')}-${valor('day')}`;
}

export function validarFecha(fecha: string): void {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith('0000') ||
      !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) {
    throw new Error(`Fecha inválida: "${fecha}". Usa AAAA-MM-DD con una fecha real.`);
  }
}

export function rejillaMadrid(fecha: string): Date[] {
  validarFecha(fecha);
  const mediodiaUTC = new Date(`${fecha}T12:00:00Z`);
  const [horas, minutos] = reloj.format(mediodiaUTC).split(':').map(Number);
  // El cambio estacional de Madrid ocurre de madrugada: al mediodía ya rige
  // el mismo desfase que en toda la ventana de validación de 11:00 a 19:00.
  const desfase = ((horas - 12) * 60 + minutos) * 60000;
  const inicio = mediodiaUTC.getTime() - 60 * 60000 - desfase;
  return Array.from({ length: 17 }, (_, i) => new Date(inicio + i * 30 * 60000));
}

export function formatearHoras(terraza: Terraza, fecha: string): string {
  const lineas = [`\n${terraza.nombre} — ${terraza.direccion} (${terraza.id}) — ${fecha}`];
  for (const d of rejillaMadrid(fecha)) {
    const estado = estaAlSol(terraza.horizonte, terraza.lat, terraza.lon, d);
    lineas.push(`  ${reloj.format(d)}  ${estado}`);
  }
  return lineas.join('\n');
}

export function consultarHoras(terrazas: Terraza[], texto: string, fecha = fechaMadrid()): string {
  if (!texto.trim()) throw new Error('Uso: npm run horas -- "<nombre o calle>" [AAAA-MM-DD]');
  validarFecha(fecha);
  const busca = texto.trim().toUpperCase();
  const candidatas = terrazas.filter((t) => `${t.nombre} ${t.direccion}`.toUpperCase().includes(busca));
  if (candidatas.length === 0) throw new Error(`No se encontró ninguna terraza para "${texto}".`);
  if (candidatas.length > 1) {
    throw new Error(`Se encontraron ${candidatas.length} terrazas para "${texto}". Concreta el nombre o la calle:\n` +
      candidatas.map((t) => `  ${t.nombre} — ${t.direccion} (${t.id})`).join('\n'));
  }
  return formatearHoras(candidatas[0], fecha);
}

if (import.meta.main) {
  try {
    const [texto, fecha, ...sobran] = process.argv.slice(2);
    if (!texto || sobran.length) throw new Error('Uso: npm run horas -- "<nombre o calle>" [AAAA-MM-DD]');
    const terrazas: Terraza[] = JSON.parse(readFileSync(DATOS, 'utf8'));
    console.log(consultarHoras(terrazas, texto, fecha));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
