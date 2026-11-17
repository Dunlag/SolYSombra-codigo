import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { estaAlSol, type Estado } from '../src/lib/sol.ts';
import { rejillaMadrid, validarFecha } from './horas.ts';
import type { Terraza } from './terraza.ts';

const raiz = resolve(import.meta.dirname, '..');
const reloj = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dia = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
export const CASOS = [
  { id: 'esquina-padilla-beatas-8', titulo: 'ESQUINA PADILLA — CL BEATAS 8', descripcion: 'Calle estrecha del centro.', mapa: '36.72355932,-4.42042993' },
  { id: 'cafe-negro-alcazabilla-9', titulo: 'CAFE NEGRO — CL ALCAZABILLA 9', descripcion: 'Calle peatonal abierta.', mapa: '36.72213878,-4.41717541' },
  { id: 'adn-merced-11', titulo: 'ADN — PL MERCED 11', descripcion: 'Plaza abierta.', mapa: '36.7234415,-4.41808528' },
  { id: 'alma-lima-maritimo-ciudad-de-melilla-9', titulo: 'ALMA LIMA — PSO MARITIMO CIUDAD DE MELILLA 9', descripcion: 'Paseo marítimo (La Malagueta).', mapa: '36.71603643,-4.41240071' },
  { id: 'chupytira-tomas-echeverria-13', titulo: 'CHUPYTIRA — CL TOMAS ECHEVERRIA 13', descripcion: 'Barrio de bloques (Huelin).', mapa: '36.70372714,-4.43419425' },
];
export type Cambio = { instante: number; desde: Estado; hasta: Estado };

export function separarVentanasBreves(cambios: Cambio[]) {
  const principales: Cambio[] = [];
  const breves: { inicio: number; fin: number }[] = [];
  for (let i = 0; i < cambios.length; i++) {
    const actual = cambios[i], siguiente = cambios[i + 1];
    // Una ventana de sol menor de 5 min puede venir de la cuantización de 2°:
    // se conserva en la hoja, aparte, para no confundirla con el cambio principal.
    if (actual.desde === 'sombra' && actual.hasta === 'sol' && siguiente?.hasta === 'sombra' &&
        siguiente.instante - actual.instante < 5 * 60000) {
      breves.push({ inicio: actual.instante, fin: siguiente.instante });
      i++;
    } else principales.push(actual);
  }
  return { principales, breves };
}

export function analizarTerraza(t: Terraza, fecha: string) {
  const rejilla = rejillaMadrid(fecha);
  const estado = (ms: number) => estaAlSol(t.horizonte, t.lat, t.lon, new Date(ms));
  const cambios: Cambio[] = [];
  const inicio = rejilla[0].getTime(), fin = rejilla.at(-1)!.getTime();
  let anterior = estado(inicio);
  // Un segundo captura también ventanas breves que no aparecen en las filas de media hora.
  for (let ms = inicio + 1000; ms <= fin; ms += 1000) {
    const actual = estado(ms);
    if (actual !== anterior) cambios.push({ instante: ms, desde: anterior, hasta: actual });
    anterior = actual;
  }
  return {
    filas: rejilla.map((d) => ({ hora: reloj.format(d).slice(0, 5), estado: estado(d.getTime()) })),
    ...separarVentanasBreves(cambios),
  };
}

export function rutasHoja(fecha = '2026-11-28', tres = 'src/data/terrazas.json', ocho = 'pipeline/raw/terrazas-8m.json', salida = 'docs/validacion-campo.md') {
  validarFecha(fecha);
  // La misma invocación desde /tmp debe leer los mismos datos y escribir la misma hoja.
  return { fecha, tres: resolve(raiz, tres), ocho: resolve(raiz, ocho), salida: resolve(raiz, salida) };
}

export function generarHoja(tres: Terraza[], ocho: Terraza[], fecha: string): string {
  validarFecha(fecha);
  const cambios = (a: ReturnType<typeof analizarTerraza>) => a.principales.length
    ? a.principales.map((c) => `${reloj.format(c.instante)} pasa a ${c.hasta}`).join('; ')
    : 'sin cambios entre las 11:00 y las 19:00';
  const primera = tres.find((t) => t.id === CASOS[0].id);
  const puesta = primera && analizarTerraza(primera, fecha).principales.find((c) => c.hasta === 'noche');
  const avisoNoche = puesta
    ? `La noche empieza alrededor de las ${reloj.format(puesta.instante).slice(0, 5)}; las filas posteriores ya indican noche.`
    : 'Las filas indican noche cuando el Sol queda bajo el horizonte.';
  let texto = `# Validación de campo — ${dia.format(new Date(`${fecha}T12:00:00Z`)).replace(',', '')} (${fecha})

Objetivo: comprobar en la calle que el cálculo de sol y sombra acierta. El prototipo web avanza en paralelo, pero la publicación general espera a la validación de campo.

## Cómo hacerlo

1. Visita cada terraza unos 20 minutos antes de la hora de cambio prevista y quédate hasta 20 minutos después.
2. Mira la zona de mesas, no la puerta del local. Anota en la columna "Real" si las mesas están al sol o a la sombra.
3. Ignora la sombra de toldos, sombrillas y árboles: el modelo solo calcula la de los edificios. Si la sombra viene de uno de ellos, anótalo.
4. Apunta la hora real a la que cambia, aunque sea aproximada, y cuál de las predicciones (3 m u 8 m) queda más cerca.

**Regla de aceptación:** la predicción de **3 m (producción)** acierta si el cambio real ocurre a menos de 30 minutos del previsto. Anota además por terraza cuál de las dos distancias queda más cerca. Con más de 1 fallo de 5 se revisa el modelo antes de la publicación general; el prototipo web puede seguir avanzando en paralelo, identificado como modelo sin validar.

Las horas dependen del día: si visitas otro día, regenera esta hoja para esa fecha. Todas las horas son de **Madrid (Europe/Madrid)**. ${avisoNoche} Los cambios se calculan cada segundo entre las 11:00 y las 19:00; esa resolución no representa precisión física de un segundo.

Para regenerar: \`node pipeline/hoja.ts ${fecha}\`. Opcionalmente: \`node pipeline/hoja.ts AAAA-MM-DD ruta-3m.json ruta-8m.json salida.md\`; las rutas relativas se resuelven desde el repositorio.
`;
  for (const [i, caso] of CASOS.entries()) {
    const buscar = (datos: Terraza[], variante: string) => {
      const encontrados = datos.filter((t) => t.id === caso.id);
      if (encontrados.length !== 1) throw new Error(`Se necesita exactamente una terraza ${caso.id} en ${variante}.`);
      return encontrados[0];
    };
    const a = analizarTerraza(buscar(tres, '3 m'), fecha);
    const b = analizarTerraza(buscar(ocho, '8 m'), fecha);
    texto += `\n## ${i + 1}. ${caso.titulo}\n\n${caso.descripcion} [Ver en el mapa](https://www.google.com/maps?q=${caso.mapa})\n\n`;
    texto += `**Cambios previstos 3 m (producción):** ${cambios(a)}\n\n**Cambios previstos 8 m (variante):** ${cambios(b)}\n`;
    for (const [metros, analisis] of [[3, a], [8, b]] as const) {
      for (const ventana of analisis.breves) {
        texto += `\n**Ventana de sol breve, ${metros} m (aparte del cambio principal):** ${reloj.format(ventana.inicio)}–${reloj.format(ventana.fin)}; posible artefacto de la cuantización de 2°. Anótala si la observas.\n`;
      }
    }
    if (!a.principales.some((c) => c.desde !== 'noche' && c.hasta !== 'noche')) {
      texto += '\nEn 3 m no hay un cambio principal entre sol y sombra durante esta franja; registra el estado observado y el paso a noche.\n';
    }
    texto += '\n| Hora | Previsto 3 m | Previsto 8 m | Real |\n|---|---|---|---|\n';
    for (const [j, fila] of a.filas.entries()) texto += `| ${fila.hora} | ${fila.estado} | ${b.filas[j].estado} | |\n`;
    texto += '\nHora real del cambio: ______  Más cerca (3 m u 8 m): ______  Notas (toldo, sombrilla, árbol, punto mal situado): ______\n';
  }
  texto += '\n## Resultado\n\n| Terraza | Hora real del cambio | Más cerca: 3 m u 8 m | Notas de toldos/árboles |\n|---|---|---|---|\n';
  for (const caso of CASOS) texto += `| ${caso.titulo} | | | |\n`;
  texto += '\nAciertos de 3 m: ____ / 5. Fallos de 3 m: ____ / 5. ¿Se revisa el modelo antes de la publicación general?: ______\n';
  return texto;
}

if (import.meta.main) {
  try {
    if (process.argv.slice(2).length > 4) throw new Error('Uso: node pipeline/hoja.ts [AAAA-MM-DD] [ruta-3m] [ruta-8m] [salida]');
    const [fecha, tresRuta, ochoRuta, salidaRuta] = process.argv.slice(2);
    const opciones = rutasHoja(fecha, tresRuta, ochoRuta, salidaRuta);
    const tres = JSON.parse(readFileSync(opciones.tres, 'utf8'));
    const ocho = JSON.parse(readFileSync(opciones.ocho, 'utf8'));
    writeFileSync(opciones.salida, generarHoja(tres, ocho, opciones.fecha));
    console.log(`Hoja generada: ${opciones.salida} (${opciones.fecha}, Europe/Madrid, 3 m y 8 m)`);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
