// Ficha de terraza (pantalla B). Bottom sheet NO modal: el mapa de detrás sigue usable, por eso no hay
// overlay, ni trampa de foco, ni handlers globales: solo onKeyDown local en el propio panel.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent } from 'react';
import { useT, type Idioma } from '../i18n';
import { textosFicha } from '../i18n/ficha';
import { enlaceMapas, lineaDia, nivelMasCercano, siguienteNivel, tramoActual, type DatosFicha, type Nivel } from '../lib/ficha.ts';
import { minutosDelDia, textoHora } from '../lib/hora.ts';
import type { Estado } from '../lib/sol.ts';
import { useEscritorio } from './useEscritorio';
import { useTema } from './useTema';
import './Ficha.css';

export type { DatosFicha };
// onNivel: App lo usa para poner `inert` en lo que la ficha tapa (WCAG 2.4.11, foco no oculto).
export type FichaProps = { terraza: DatosFicha | null; fecha: Date; idioma: Idioma; onClose: () => void; onNivel?: (n: Nivel) => void };

const VAR_ALTURAS = ['--ss-panel-reposo', '--ss-panel-media', '--ss-panel-completa'];
const UMBRAL_ARRASTRE = 6; // px: por debajo es un toque (cicla altura), por encima un arrastre

// Hora de Madrid (como el resto de la app), no la del dispositivo.
const hhmm = (d: Date) => textoHora(minutosDelDia(d));
const duracion = (ms: number) => {
  const min = Math.round(ms / 60_000), h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};

// Solo ilustrativo: el modelo de sombra es por horizonte (no sabe si la sombra viene de un edificio o del
// relieve), pero el icono de "sombra con edificio" es el único que el diseño define para sombra.
const icono = (tema: string, e: Estado) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/marcadores/${tema}-${e === 'sombra' ? 'sombra-edificio' : e}.svg`;

export default function Ficha({ terraza, fecha, idioma, onClose, onNivel }: FichaProps) {
  const t = useT(idioma), tf = textosFicha(idioma);
  const tema = useTema();
  const escritorio = useEscritorio(); // panel de columna: sin asa ni niveles, siempre con todo el detalle
  const [nivelEstado, setNivel] = useState<Nivel>(0);
  const nivel: Nivel = escritorio ? 2 : nivelEstado;
  const panel = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();
  const opener = useRef<HTMLElement | null>(null); // quién tenía el foco al abrir: se le devuelve al cerrar (WCAG 2.4.3)
  const arrastre = useRef<{ y0: number; alto0: number; alturas: [number, number, number]; movido: boolean } | null>(null);
  const hizoArrastre = useRef(false);

  // Terraza nueva: vuelve a reposo y el foco pasa al título (h2) para que el lector anuncie el nombre y
  // Esc funcione sin handlers globales (el keydown sube hasta la sección). Al cerrar, el foco vuelve a
  // donde estaba; si ya no existe (o era <body>), al canvas del mapa, que es de donde se abre.
  const id = terraza?.id;
  useEffect(() => {
    setNivel(0);
    if (id) {
      if (!panel.current?.contains(document.activeElement)) opener.current = document.activeElement as HTMLElement | null;
      titulo.current?.focus();
    } else if (opener.current) {
      const o = opener.current;
      opener.current = null;
      // Un fotograma después: si la ficha estaba en media/completa, el mapa sigue `inert` hasta que App
      // procese onNivel(0), y un elemento inert no admite foco.
      requestAnimationFrame(() =>
        (o.isConnected && o !== document.body ? o : document.querySelector<HTMLElement>('.maplibregl-canvas'))?.focus());
    }
  }, [id]);
  const abierta = !!terraza;
  useEffect(() => { onNivel?.(abierta && !escritorio ? nivelEstado : 0); }, [abierta, escritorio, nivelEstado]);

  // El cálculo recorre el día en pasos de 5 min: se memoiza por terraza y minuto.
  const minuto = Math.floor(fecha.getTime() / 60_000);
  const tramo = useMemo(() => (terraza ? tramoActual(terraza, new Date(minuto * 60_000)) : null), [terraza, minuto]);
  const dia = useMemo(() => (terraza && nivel === 2 ? lineaDia(terraza, new Date(minuto * 60_000)) : null), [terraza, nivel, Math.floor(minuto / 1440)]);

  if (!terraza || !tramo) return null;
  const { estado } = tramo;

  // --- arrastre del asa (pointer events). La alternativa sin arrastre es el clic/Enter en el asa y los botones.
  const medirAlturas = (): [number, number, number] => {
    // Las alturas son variables CSS (calc/dvh): se resuelven a px con un elemento sonda.
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0';
    document.body.appendChild(sonda);
    const r = VAR_ALTURAS.map((v) => { sonda.style.height = `var(${v})`; return sonda.offsetHeight; });
    sonda.remove();
    return r as [number, number, number];
  };
  const alPulsar = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary || !panel.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { y0: e.clientY, alto0: panel.current.offsetHeight, alturas: medirAlturas(), movido: false };
  };
  const alMover = (e: RPointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current;
    if (!a || !panel.current) return;
    const dy = a.y0 - e.clientY; // hacia arriba = más alto
    if (!a.movido && Math.abs(dy) < UMBRAL_ARRASTRE) return;
    a.movido = true;
    panel.current.dataset.arrastrando = '';
    panel.current.style.height = `${Math.min(a.alturas[2], Math.max(a.alturas[0], a.alto0 + dy))}px`;
  };
  const alSoltar = (e: RPointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a || !panel.current) return;
    if (a.movido) {
      hizoArrastre.current = true; // el click que sigue al pointerup no debe ciclar además
      setNivel(nivelMasCercano(parseFloat(panel.current.style.height), a.alturas));
    }
    panel.current.style.height = '';
    delete panel.current.dataset.arrastrando;
  };
  const alClicAsa = () => {
    if (hizoArrastre.current) { hizoArrastre.current = false; return; }
    setNivel(siguienteNivel(nivel));
  };
  const alTeclar = (e: RKeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };

  const hora = hhmm(fecha);
  const parentesis = estado === 'sol' ? t.alSolA(hora) : tf.parentesis[estado](hora);
  const extra = tramo.hasta
    ? `${duracion(tramo.hasta.getTime() - fecha.getTime())} · ${tf.luego[tramo.siguiente!]}`
    : tf.sinCambios;

  return (
    <section ref={panel} className="ficha" data-nivel={nivel} data-estado={estado} aria-labelledby={idTitulo} onKeyDown={alTeclar}>
      {!escritorio && <button type="button" className="ficha__asa" aria-label={tf.asa(nivel)}
        onPointerDown={alPulsar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar} onClick={alClicAsa}>
        <span />
      </button>}

      <div className="ficha__cabecera">
        <div className="ficha__titulo">
          <span className="ficha__estado">
            <img src={icono(tema, estado)} alt="" />{tf.estado[estado]}
          </span>
          <span className="ficha__hora">{parentesis}</span>
          <h2 ref={titulo} id={idTitulo} tabIndex={-1} className="ficha__nombre">{terraza.nombre}</h2>
        </div>
        <button type="button" className="ficha__cerrar" aria-label={tf.cerrar} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ficha__cuerpo">
        <div className="ficha__hasta">
          {tramo.hasta && <span className="ficha__hasta-et">{t.hastaLas}</span>}
          <span className="ficha__hasta-hora">{tramo.hasta ? hhmm(tramo.hasta) : '—'}</span>
          <span className="ficha__hasta-extra">{extra}</span>
        </div>

        {nivel >= 1 && (
          <dl className="ficha__datos">
            <div><dt>{t.direccion}</dt><dd>{terraza.direccion}</dd></div>
            <div><dt>{t.distrito}</dt><dd>{terraza.distrito}</dd></div>
          </dl>
        )}

        {dia && (
          <div>
            <div role="img" aria-label={`${tf.lineaDia}: ${resumen(dia, tf.leyenda)}`}>
              <div className="ficha__linea">{dia.map((e, i) => <span key={i} className="ficha__barra" data-e={e} />)}</div>
              <div className="ficha__ejes" aria-hidden="true">
                {[6, 12, 18].map((h) => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</span>)}
              </div>
            </div>
            <div className="ficha__leyenda">
              {(['sol', 'sombra', 'noche'] as const).map((e) => <span key={e} data-e={e}><i />{tf.leyenda[e]}</span>)}
            </div>
          </div>
        )}

        <div className="ficha__acciones">
          {!escritorio && nivel === 0 && <button type="button" className="ficha__btn" onClick={() => setNivel(1)}>{tf.masDetalles}</button>}
          {!escritorio && nivel === 1 && <button type="button" className="ficha__btn" onClick={() => setNivel(2)}>{t.diaCompleto}</button>}
          {nivel >= 1 && (
            <a className="ficha__btn ficha__btn--primario" href={enlaceMapas(terraza)} target="_blank" rel="noopener noreferrer">
              {t.abrirEnMapas}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// Descripción textual de la línea del día para lectores de pantalla: tramos consecutivos "sol 10:00–13:30".
function resumen(dia: Estado[], et: Record<Estado, string>): string {
  const f = (i: number) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
  const partes: string[] = [];
  for (let i = 0, ini = 0; i <= dia.length; i++) {
    if (i === dia.length || dia[i] !== dia[ini]) { partes.push(`${et[dia[ini]]} ${f(ini)}–${f(i % 48)}`); ini = i; }
  }
  return partes.join(', ');
}
