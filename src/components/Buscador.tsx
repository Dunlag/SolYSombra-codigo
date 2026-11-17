// Buscador de local (combobox ARIA 1.2 con lista). Tonto: recibe datos y emite el índice elegido.
import { useId, useMemo, useState } from 'react';
import './Buscador.css';
import { useT, type Idioma } from '../i18n';
import { textosFicha } from '../i18n/ficha';
import { buscarTodo, type Barrio, type Resultado } from '../lib/buscar.ts';
import type { Estado, Terraza } from '../lib/terrazas.ts';
import { useTema } from './useTema';

type Props = { terrazas: Terraza[]; barrios: Barrio[]; estados: Estado[]; idioma: Idioma; onElegir: (i: number) => void; onElegirBarrio: (i: number) => void; inert?: boolean };

export default function Buscador({ terrazas, barrios, estados, idioma, onElegir, onElegirBarrio, inert }: Props) {
  const t = useT(idioma), tf = textosFicha(idioma), tema = useTema();
  const id = useId(), idLista = `${id}-l`;
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(true); // Esc cierra la lista sin borrar el texto
  const [activo, setActivo] = useState(0);
  const res = useMemo(() => buscarTodo(terrazas, barrios, q), [terrazas, barrios, q]);
  const visible = abierto && q.trim().length >= 2;

  const elegir = (r: Resultado) => { (r.tipo === 'barrio' ? onElegirBarrio : onElegir)(r.i); setQ(''); setActivo(0); };
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && res.length) { e.preventDefault(); setAbierto(true); setActivo((activo + 1) % res.length); }
    else if (e.key === 'ArrowUp' && res.length) { e.preventDefault(); setActivo((activo + res.length - 1) % res.length); }
    else if (e.key === 'Enter' && visible && res[activo] !== undefined) { e.preventDefault(); elegir(res[activo]); }
    else if (e.key === 'Escape') { if (visible) { e.preventDefault(); setAbierto(false); } else setQ(''); }
  };

  return (
    <div className="bus" inert={inert}>
      <input className="bus__in" type="search" role="combobox" aria-expanded={visible} aria-controls={idLista}
        aria-autocomplete="list" aria-label={t.buscar} placeholder={t.buscar} autoComplete="off" spellCheck={false}
        aria-activedescendant={visible && res.length ? `${id}-${activo}` : undefined}
        value={q} onChange={(e) => { setQ(e.target.value); setAbierto(true); setActivo(0); }} onKeyDown={tecla} />
      <ul id={idLista} role="listbox" aria-label={t.buscar} className="bus__lista" hidden={!visible}>
        {res.map((r, n) => r.tipo === 'barrio' ? (
          <li key={`b-${barrios[r.i].id}`} id={`${id}-${n}`} role="option" aria-selected={n === activo} className="bus__op"
            onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(r)}>
            {/* Icono propio del barrio: contorno de polígono (decorativo). */}
            <svg className="bus__barrio" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 9l9-5 9 6-2 11-11 2z" />
            </svg>
            <span className="bus__txt"><b>{barrios[r.i].nombre}</b><span>{t.barrioN(barrios[r.i].terrazas.length)}</span></span>
            <span className="bus__est">{t.barrio}</span>
          </li>
        ) : (
          <li key={terrazas[r.i].id} id={`${id}-${n}`} role="option" aria-selected={n === activo} className="bus__op"
            onMouseDown={(e) => e.preventDefault() /* el input no pierde el foco */} onClick={() => elegir(r)}>
            <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/marcadores/${tema}-${estados[r.i] === 'sombra' ? 'sombra-edificio' : estados[r.i]}.svg`} alt="" width="28" height="28" />
            <span className="bus__txt"><b>{terrazas[r.i].nombre}</b><span>{terrazas[r.i].direccion}</span></span>
            <span className="bus__est">{tf.leyenda[estados[r.i]]}</span>
          </li>
        ))}
        {visible && !res.length && <li className="bus__vacio" role="presentation">{t.buscarSin}</li>}
      </ul>
      <p className="bus__sr" role="status">{visible ? (res.length ? t.buscarN(res.length) : t.buscarSin) : ''}</p>
    </div>
  );
}
