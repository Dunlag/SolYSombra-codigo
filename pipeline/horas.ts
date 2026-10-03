import { readFileSync } from 'node:fs';
import { estaAlSol } from '../src/lib/sol.ts';
import type { Terraza } from './terraza.ts';

const [texto, fecha = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!texto) {
  console.error('Uso: npm run horas -- "<nombre o calle>" [AAAA-MM-DD]');
  process.exit(1);
}

const terrazas: Terraza[] = JSON.parse(readFileSync('src/data/terrazas.json', 'utf8'));
const busca = texto.toUpperCase();
const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

for (const t of terrazas.filter((t) => `${t.nombre} ${t.direccion}`.toUpperCase().includes(busca))) {
  console.log(`\n${t.nombre} — ${t.direccion} (${t.id}) — ${fecha}`);
  const inicio = new Date(`${fecha}T04:00:00Z`).getTime();
  for (let i = 0; i < 38; i++) { // cada 30 min, de 04:00 a 22:30 UTC
    const d = new Date(inicio + i * 30 * 60000);
    const estado = estaAlSol(t.horizonte, t.lat, t.lon, d);
    if (estado !== 'noche') console.log(`  ${hora.format(d)}  ${estado}`);
  }
}
