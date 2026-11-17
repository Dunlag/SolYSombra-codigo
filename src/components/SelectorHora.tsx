// Selector de hora (pantalla C y zona inferior de A). Componente "tonto": recibe el histograma ya
// calculado y emite la nueva Date; no importa terrazas ni estaAlSol.
import { useEffect, useMemo, useRef, useState } from 'react';
import './SelectorHora.css';
import { useT, type Idioma } from '../i18n';
import { es as hEs, en as hEn } from '../i18n/hora';
import {
  MAX, MIN, PASO, ahora, aFecha, aISO, conDiaISO, etiquetaFecha, manana, masUnaHora,
  minutosDelDia, normalizarHistograma, relativa, tarde, textoHora,
} from '../lib/hora.ts';

type Props = {
  fecha: Date;
  onChange: (f: Date) => void;
  /** Terrazas al sol por tramo del día 08:00-22:00 (cualquier nº de barras). Se normaliza aquí. */
  histograma: number[];
  alSol: number;
  total: number;
  idioma: Idioma;
  /** Móvil: barra baja de una fila; chips y fecha en un panel que se expande hacia arriba. */
  compacto?: boolean;
  /** App lo activa cuando la ficha lo tapa (WCAG 2.4.11). */
  inert?: boolean;
};

const ALTO = 64;                 // px del histograma
const ALTO_COMPACTO = 30;
const THUMB = 44;                // zona táctil del thumb (px); las barras se alinean a su recorrido
const MARCAS = [8, 11, 14, 17, 20, 22];
const frac = (min: number) => (min - MIN) / (MAX - MIN);

export default function SelectorHora({ fecha, onChange, histograma, alSol, total, idioma, compacto, inert }: Props) {
  const t = useT(idioma);
  const [abierto, setAbierto] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const th = idioma === 'en' ? hEn : hEs;
  // El reloj va en estado para que "Ahora" se actualice solo cada minuto.
  const [reloj, setReloj] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Valor "en vivo" mientras se arrastra: el padre solo recibe 1 cambio por frame (rAF),
  // pero el thumb y la hora tienen que seguir al dedo sin esperar a ese re-render.
  const [vivo, setVivo] = useState<number | null>(null);
  const [enRango, setEnRango] = useState(false); // foco en el slider: ahí el aria-valuetext ya anuncia la hora
  const min = vivo ?? minutosDelDia(fecha);
  const pendiente = useRef<number | null>(null);
  const raf = useRef(0);
  const ultima = useRef({ fecha, onChange });
  ultima.current = { fecha, onChange };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const programar = (nuevo: number) => {
    setVivo(nuevo);
    pendiente.current = nuevo;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const v = pendiente.current;
      pendiente.current = null;
      if (v === null) return;
      ultima.current.onChange(aFecha(ultima.current.fecha, v));
      setVivo(null);
    });
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Flechas, Inicio y Fin ya los resuelve el range nativo (±step). RePág/AvPág los hacemos nosotros: ±1 h.
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    programar(Math.min(MAX, Math.max(MIN, min + (e.key === 'PageUp' ? 60 : -60))));
  };

  const barras = useMemo(() => normalizarHistograma(histograma), [histograma]);
  const idxSel = Math.min(barras.length - 1, Math.floor(frac(min) * barras.length));

  const hora = textoHora(min);
  const rel = relativa(fecha, reloj);
  const relTxt = rel === 'ahora' ? t.relAhora : rel === 'hoy' ? t.relHoy : rel === 'manana' ? t.relManana : '';
  const f = aFecha(fecha, min);
  const mismo = (a: Date) => a.getTime() === f.getTime();
  const chips: { clave: string; texto: string; destino: Date; activo: boolean }[] = [
    { clave: 'ahora', texto: t.ahora, destino: ahora(reloj), activo: rel === 'ahora' },
    // +1 h avanza desde la hora elegida; "activo" solo si coincide con ahora+1h (si no, un chip de acción nunca queda marcado).
    { clave: 'mas', texto: t.masUnaHora, destino: masUnaHora(f), activo: mismo(masUnaHora(ahora(reloj))) },
    { clave: 'tarde', texto: t.tarde, destino: tarde(f), activo: (rel === 'hoy' || rel === 'ahora') && min === 17 * 60 },
    // Si ya estás en mañana, el chip no te empuja otro día más.
    { clave: 'manana', texto: t.manana, destino: rel === 'manana' ? f : manana(f), activo: rel === 'manana' },
  ];

  const alto = compacto ? ALTO_COMPACTO : ALTO;
  // Esc pliega el panel; el foco pasa al botón (si no, se perdería en un chip ya oculto).
  const alEscape = (e: React.KeyboardEvent) => {
    if (compacto && abierto && e.key === 'Escape') { e.stopPropagation(); setAbierto(false); toggle.current?.focus(); }
  };

  const horaCol = (
        <div className="sh-hora-col">
          <span className="sh-rel">{relTxt} {etiquetaFecha(f, idioma)}</span>
          {/* Con el foco en el slider el <output> se calla (si no, doble anuncio con valuetext); con chips/fecha anuncia. */}
          <output htmlFor="sh-rango" aria-live={enRango ? 'off' : 'polite'} className="sh-hora">{hora}</output>
        </div>
  );

  const escala = (
      <div className="sh-escala" style={{ ['--pos' as string]: frac(min) }}>
        <div className="sh-barras" aria-hidden="true" style={{ height: alto }}>
          {barras.map((v, i) => (
            // Altura = nº de terrazas; las barras sin sol son un tocón corto y gris (forma + color).
            <span
              key={i}
              className={`sh-barra${v === 0 ? ' sh-barra-0' : ''}${i === idxSel ? ' sh-barra-sel' : ''}`}
              style={{ height: Math.max(6, Math.round(v * (alto - 4))) }}
            />
          ))}
        </div>
        <span className="sh-linea" aria-hidden="true" />
        <span className="sh-knob" aria-hidden="true" />
        <label htmlFor="sh-rango" className="sh-solo-lector">{t.hora}</label>
        <input
          id="sh-rango" className="sh-rango" type="range"
          min={MIN} max={MAX} step={PASO} value={min}
          aria-valuetext={hora}
          onChange={(e) => programar(Number(e.target.value))}
          onKeyDown={alTeclear}
          onFocus={() => setEnRango(true)} onBlur={() => setEnRango(false)}
        />
        {!compacto && (
          <div className="sh-marcas" aria-hidden="true">
            {MARCAS.map((h) => (
              <span key={h} style={{ ['--p' as string]: frac(h * 60) }}>{String(h).padStart(2, '0')}</span>
            ))}
          </div>
        )}
      </div>
  );

  const chipsYFecha = (
      <div className="sh-chips">
        {chips.map((c) => (
          <button
            key={c.clave} type="button" className="sh-chip" aria-current={c.activo ? 'true' : undefined}
            onClick={() => onChange(c.destino)}
          >{c.texto}</button>
        ))}
        <label className="sh-fecha">
          <span className="sh-solo-lector">{th.dia}</span>
          <input
            type="date" value={aISO(f)}
            onChange={(e) => { const n = conDiaISO(f, e.target.value); if (n) onChange(n); }}
          />
        </label>
      </div>
  );

  return (
    <section className={`sh${compacto ? ' sh--c' : ''}`} aria-label={t.hora} inert={inert} onKeyDown={alEscape}>
      {compacto ? (
        <>
          {/* El panel va ANTES de la fila: se despliega hacia arriba y el orden de foco sigue el visual. */}
          <div id="sh-extra" className="sh-extra" hidden={!abierto}>{chipsYFecha}</div>
          <div className="sh-fila">
            {horaCol}
            {escala}
            <button ref={toggle} type="button" className="sh-toggle" aria-expanded={abierto} aria-controls="sh-extra"
              aria-label={abierto ? t.horaMenos : t.horaMas} onClick={() => setAbierto(!abierto)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true"><polyline points="5,15 12,8 19,15" /></svg>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sh-cabecera">
            {horaCol}
            <div className="sh-cuenta">
              <span className="sh-cuenta-n">{alSol}</span>
              <span className="sh-cuenta-t">{t.terrazasAlSol}<br />{t.de} {total}</span>
            </div>
          </div>
          {escala}
          {chipsYFecha}
        </>
      )}
    </section>
  );
}

export type { Props as SelectorHoraProps };
