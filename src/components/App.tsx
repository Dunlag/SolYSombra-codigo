// Isla React de la pantalla A. Es el ÚNICO dueño del estado: {fecha, seleccionId, idioma, tema}.
// Mapa, SelectorHora y Ficha son "tontos": reciben props y emiten eventos.
// Estructura (como V2-A): cabecera-tile / tile del mapa / tile de la hora, en columna.
// Decisión: el selector NO se superpone al mapa (el brief decía "superpuesto"), va debajo como en el
// diseño; así la atribución de OpenStreetMap (abajo del mapa, obligatoria) nunca queda tapada.
//
// TECLADO (pendiente, pantalla D): los marcadores son una capa de símbolos de WebGL; solo el canvas
// recibe foco y no se pueden recorrer con Tab. Alternativa propuesta: una lista de terrazas
// (ordenada por cercanía/sol) navegable con teclado y lectores de pantalla que llame a onSelect.
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import terrazasJson from '../data/terrazas.json';
import barriosJson from '../data/barrios.json';
import zonasJson from '../data/zonas.json';
import { idiomaDe, useT, type Idioma } from '../i18n';
import { aFecha, ahora, aISO, MAX, MIN } from '../lib/hora.ts';
import type { Nivel } from '../lib/ficha.ts';
import { contarAlSol, estados, type Estado, type Terraza } from '../lib/terrazas.ts';
import { minutosDelDia, textoHora } from '../lib/hora.ts';
import { ZONAS, aZona, nombreZona, resolverZonas, type Zona, type ZonaUnida } from '../lib/alias.ts';
import type { Barrio } from '../lib/buscar.ts';
import { enEclipse } from '../lib/eclipse.ts';
import { textosFicha } from '../i18n/ficha';
import Buscador from './Buscador';
import Ficha from './Ficha';
import Mapa from './Mapa';
import SelectorHora from './SelectorHora';
import { useEscritorio } from './useEscritorio';
import { useTema } from './useTema';

const TERRAZAS = terrazasJson as Terraza[];
const BARRIOS = barriosJson as Barrio[];
const ZONAS_R = resolverZonas(ZONAS, BARRIOS, TERRAZAS, zonasJson as ZonaUnida[]);
const CLAVE_IDIOMA = 'ss-idioma';

// Histograma: 28 barras de 30 min entre 08:00 y 22:00, muestreadas en el centro de cada tramo.
// Medido en Node (ThinkPad, 1665 terrazas): 5 min (169 puntos) = 320-400 ms, bloquearía el hilo
// principal; 30 min = ~55 ms, y además 169 barras no caben en 390 px. Se recalcula solo al cambiar de DÍA.
const TRAMO = 30;
const N_BARRAS = (MAX - MIN) / TRAMO;
const histogramaDelDia = (dia: Date): number[] =>
  Array.from({ length: N_BARRAS }, (_, i) =>
    contarAlSol(TERRAZAS, aFecha(dia, MIN + i * TRAMO + TRAMO / 2)));

// localStorage puede lanzar (modo privado, cookies bloqueadas): nunca debe romper la app.
function idiomaInicial(): Idioma {
  try {
    const g = localStorage.getItem(CLAVE_IDIOMA);
    if (g === 'es' || g === 'en') return g;
  } catch { /* sin almacenamiento: se usa el del navegador */ }
  return idiomaDe(navigator.language);
}

export default function App() {
  const [fecha, setFecha] = useState(() => ahora());
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);
  const tema = useTema();
  const escritorio = useEscritorio();
  const t = useT(idioma);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [nivelFicha, setNivelFicha] = useState<Nivel>(0);
  // Chips-filtro: por defecto ambos apagados = mapa sin terrazas; el usuario elige qué ver.
  const [filtro, setFiltro] = useState({ sol: false, sombra: false });
  // Barrio activo: se demarca en el mapa y limita los marcadores; los chips deciden qué estado se ve dentro.
  const [barrio, setBarrio] = useState<(Zona & { tipo: 'barrio' | 'zona' }) | null>(null); // barrio real o zona (unión de barrios / caja)
  const [encuadre, setEncuadre] = useState<{ bbox: Barrio['bbox']; k: number } | null>(null);
  const [volarA, setVolarA] = useState<{ lon: number; lat: number; k: number } | null>(null);

  useEffect(() => {
    document.documentElement.lang = idioma; // lectores de pantalla: pronunciación correcta
    try { localStorage.setItem(CLAVE_IDIOMA, idioma); } catch { /* ver idiomaInicial */ }
  }, [idioma]);

  const dia = aISO(fecha);
  // Depende solo del día (no de la hora): arrastrar el slider no recalcula las 28 barras.
  const histograma = useMemo(() => histogramaDelDia(fecha), [dia]);
  // Un único cálculo por cambio de hora (~1 ms): lo comparten el contador y el mapa.
  const est = useMemo(() => estados(TERRAZAS, fecha), [fecha]);
  // Ids del barrio (null = sin barrio) y contadores de los chips: solo dentro del barrio mientras haya uno.
  const idsBarrio = useMemo(() => (barrio ? new Set(barrio.terrazas) : null), [barrio]);
  const alSol = useMemo(() => est.filter((e) => e === 'sol').length, [est]);
  const enBarrio = (e: Estado) => est.filter((x, i) => x === e && (!idsBarrio || idsBarrio.has(TERRAZAS[i].id))).length;
  const chipSol = useMemo(() => enBarrio('sol'), [est, idsBarrio]);
  const chipSombra = useMemo(() => enBarrio('sombra'), [est, idsBarrio]);
  const tf = textosFicha(idioma), tituloResumen = t.resumenA(textoHora(minutosDelDia(fecha)));
  const nSombra = useMemo(() => est.filter((e) => e === 'sombra').length, [est]);
  // Solo las elegidas ([] = ninguna), en escritorio y en móvil.
  const visibles = useMemo(() => (['sol', 'sombra'] as const).filter((e) => filtro[e]), [filtro]);
  const activar = (tipo: 'barrio' | 'zona', b: Zona) => {
    setBarrio({ ...b, tipo });
    setSeleccionId(null); // la ficha taparía el barrio recién demarcado
    setEncuadre({ bbox: b.bbox, k: Date.now() });
  };
  const elegirBarrio = (i: number) => activar('barrio', aZona(BARRIOS[i]));
  const elegirZona = (i: number) => activar('zona', ZONAS_R[i]);
  const quitarBarrio = () => { setBarrio(null); setEncuadre(null); };
  // Esc quita el barrio si nada más lo ha consumido (lista del buscador, ficha, diálogo, hora).
  useEffect(() => {
    if (!barrio) return;
    const alTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !dialogo.current?.open) quitarBarrio(); };
    document.addEventListener('keydown', alTeclar);
    return () => document.removeEventListener('keydown', alTeclar);
  }, [barrio]);
  const elegirDeBuscador = (i: number) => {
    const x = TERRAZAS[i];
    setSeleccionId(x.id);
    setVolarA({ lon: x.lon, lat: x.lat, k: Date.now() });
  };
  const fase = enEclipse(fecha);
  const terraza = useMemo(() => TERRAZAS.find((x) => x.id === seleccionId) ?? null, [seleccionId]);

  return (
    <main className="app" data-barrio={barrio ? '' : undefined} data-ficha={terraza ? '' : undefined} data-nivel={terraza ? nivelFicha : undefined}>
      {/* `inert` (WCAG 2.4.11): la ficha en nivel media/completa (position:fixed) taparía el elemento enfocado
          con Tab. Es lo más simple que mantiene el foco visible: lo tapado deja de ser enfocable. La cabecera
          solo queda cubierta en el nivel completo. */}
      <header className="app__tile app__cabecera" inert={nivelFicha === 2}>
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--ss-sombra)" />
          <circle cx="12" cy="12" r="4.5" fill="var(--ss-hueco)" />
        </svg>
        <h1 className="app__titulo">{t.appTitulo}</h1>
        <button type="button" className="app__btn" aria-label={t.cambiarIdioma}
          onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')}>{t.idiomaOtro}</button>
        <button type="button" className="app__btn" aria-label={t.abrirLimitaciones}
          onClick={() => dialogo.current?.showModal()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12" y2="7.5" />
          </svg>
        </button>
      </header>

      <div className="app__mapa" inert={nivelFicha >= 1}>
        <Mapa terrazas={TERRAZAS} estados={est} seleccionId={seleccionId} onSelect={setSeleccionId} tema={tema} idioma={idioma} visibles={visibles} volarA={volarA}
          barrio={barrio?.geometrias ?? null} soloIds={barrio?.terrazas ?? null}
          encuadre={encuadre && { ...encuadre, padding: escritorio ? { top: 40, bottom: 40, left: 380 + 48, right: 90 } : { top: 130, bottom: 120, left: 24, right: 24 } }} />
        {/* Pill discreta: texto corto en móvil, largo en escritorio (CSS). */}
        <p className="app__rotulo"><span className="app__rotulo-c">{t.prototipo}</span><span className="app__rotulo-l">{t.prototipoLargo}</span></p>
      </div>

      {/* Easter egg del eclipse: role=status (educado) anuncia el cambio de fase; el aviso de gafas es fijo. */}
      {fase && (
        <div className="app__eclipse" data-fase={fase} role="status" inert={nivelFicha === 2}>
          <p className="app__eclipse-t">{t.eclipse[fase]}</p>
          <p className="app__eclipse-a">{t.eclipse.aviso}</p>
        </div>
      )}

      <div className="app__filtros" role="group" aria-label={t.filtros} inert={nivelFicha === 2}>
          {([['sol', t.filtroSol, chipSol], ['sombra', t.filtroSombra, chipSombra]] as const).map(([e, txt, n]) => (
            <button key={e} type="button" className="app__chip" data-e={e} aria-pressed={filtro[e]}
              onClick={() => setFiltro({ ...filtro, [e]: !filtro[e] })}>{txt} <b>{n}</b></button>
          ))}
      </div>

      {/* Escritorio: una columna flotante (buscador + hora/resumen, o ficha). En móvil los wrappers son `display: contents` y buscador, filtros, cabecera y barra de hora flotan sobre el mapa. */}
      <div className="app__panel">
        <Buscador terrazas={TERRAZAS} barrios={BARRIOS} zonas={ZONAS_R} estados={est} idioma={idioma} onElegir={elegirDeBuscador} onElegirBarrio={elegirBarrio} onElegirZona={elegirZona} inert={nivelFicha === 2} />
        {barrio && (
          <div className="app__barrio" inert={nivelFicha === 2}>
            <button type="button" className="app__barrio-b" aria-label={(barrio.tipo === 'zona' ? t.zonaQuitar : t.barrioQuitar)(nombreZona(barrio, idioma))} onClick={quitarBarrio}>
              <span className="app__barrio-t">{barrio.tipo === 'zona' ? t.zona : t.barrio} <b>{nombreZona(barrio, idioma)}</b></span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
            <p className="bus__sr" role="status">{visibles.length ? '' : barrio.tipo === 'zona' ? t.zonaSinElegir : t.barrioSinElegir}</p>
          </div>
        )}
        <div className="app__cuerpo">
          {!(escritorio && terraza) && <SelectorHora fecha={fecha} onChange={setFecha} histograma={histograma} alSol={alSol} total={TERRAZAS.length} idioma={idioma} compacto={!escritorio} inert={nivelFicha >= 1} />}

          {escritorio && !terraza && (
            <section className="app__tile app__resumen" aria-label={tituloResumen}>
              <span className="app__resumen-t">{tituloResumen}</span>
              <div className="app__resumen-cajas">
                {([['sol', alSol], ['sombra', nSombra], ['noche', TERRAZAS.length - alSol - nSombra]] as const).map(([e, n]) => (
                  <div key={e} data-e={e}><b>{n}</b><span>{tf.estado[e]}</span></div>
                ))}
              </div>
            </section>
          )}

          <Ficha terraza={terraza} fecha={fecha} idioma={idioma} onClose={() => setSeleccionId(null)} onNivel={setNivelFicha} />
        </div>
      </div>

      {/* <dialog> nativo + showModal(): el navegador atrapa el foco, cierra con Esc y devuelve el foco al botón. */}
      <dialog ref={dialogo} className="app__dialogo" aria-labelledby="app-dlg-t"
        onClick={(e) => { if (e.target === dialogo.current) dialogo.current.close(); }}>
        {/* El relleno va en este div y no en el <dialog>: así un clic en el padding no cuenta como clic en el fondo. */}
        <div className="app__dialogo-in">
          <h2 id="app-dlg-t">{t.limitacionesTitulo}</h2>
          <p>{t.prototipoLargo}</p>
          <h3>{t.fuentesTitulo}</h3>
          <ul>{t.fuentes.map((f) => <li key={f}>{f}</li>)}</ul>
          <button type="button" className="app__btn app__cerrar" autoFocus onClick={() => dialogo.current?.close()}>{t.cerrar}</button>
        </div>
      </dialog>
    </main>
  );
}
