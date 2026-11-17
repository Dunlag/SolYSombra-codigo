// Isla React del mapa (pantalla A). Se monta con client:only="react": maplibre-gl usa
// window/WebGL al importarse y fallaría al prerenderizar en el servidor.
import { useEffect, useRef, useState } from 'react';
import { Map as MapaGL, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Mapa.css';
import { useT, type Idioma } from '../i18n';
import { aGeoJSON, type Estado, type Terraza } from '../lib/terrazas.ts';

export type Tema = 'wave' | 'lotus';
type Props = {
  terrazas: Terraza[];
  /** Estado de cada terraza (mismo orden que `terrazas`): lo calcula App una sola vez por cambio de hora. */
  estados: Estado[];
  seleccionId: string | null;
  onSelect: (id: string | null) => void;
  tema: Tema;
  idioma: Idioma;
  /** Estados visibles (chips-filtro); null = todos, [] = ninguno (la terraza elegida siempre se ve). */
  visibles: Estado[] | null;
  /** Pide volar a una terraza; `k` distinto fuerza repetir el vuelo al mismo punto. */
  volarA: { lon: number; lat: number; k: number } | null;
};

// Vite (dev) preempaqueta maplibre en .vite/deps y allí no existe el worker (504 → mapa en blanco):
// se le da su URL explícita, que también vale para el build.
setWorkerUrl(workerUrl);

const ESTILO = 'https://tiles.openfreemap.org/styles/positron';
const CENTRO: [number, number] = [-4.4214, 36.7213]; // [lon, lat]
const ESTADOS: Estado[] = ['sol', 'sombra', 'noche'];
const FUENTE = 'terrazas', CAPA = 'terrazas-iconos', CAPA_SEL = 'terrazas-seleccion';
// Anillo de selección: el naranja no llega a 3:1 sobre el mapa claro (positron #e8e8e8), así que Lotus usa tinta.
const COLOR_SEL: Record<Tema, string> = { wave: '#FF9E3B', lotus: '#1F1F28' };
const TAP = 44; // zona táctil mínima (px): el icono mide ~28, el área de clic se amplía

// Rasteriza el SVG a 2× para que no se vea borroso en pantallas retina (pixelRatio: 2).
async function cargarIcono(url: string): Promise<ImageBitmap> {
  const img = new Image(); // SVG con viewBox y sin width/height: hay que fijar el tamaño antes
  img.width = img.height = 56;
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 56;
  c.getContext('2d')!.drawImage(img, 0, 0, 56, 56);
  return createImageBitmap(c);
}

export default function Mapa({ terrazas, estados, seleccionId, onSelect, tema, idioma, visibles, volarA }: Props) {
  const t = useT(idioma);
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(false); // sin estilo/WebGL/iconos: aviso visible dentro del tile, el resto de la UI sigue
  // onSelect en ref: el listener se registra una sola vez y no queda con un callback viejo.
  const alElegir = useRef(onSelect);
  alElegir.current = onSelect;

  // 1) Crear el mapa una vez.
  useEffect(() => {
    let m: MapaGL;
    try {
      m = new MapaGL({
        container: div.current!,
        style: ESTILO,
        center: CENTRO,
        zoom: 14,
        // Atribución siempre desplegada: OpenStreetMap la exige y no se oculta.
        attributionControl: { compact: false },
      });
    } catch { // p. ej. WebGL no disponible: sin esto la excepción desmontaría toda la isla
      setError(true);
      return;
    }
    mapa.current = m;
    // Botones de zoom (WCAG 2.5.1: alternativa al pellizco/rueda). Sin brújula: el mapa no rota.
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    let cargado = false;
    // 'error' también salta por teselas sueltas que fallan con el mapa ya funcionando: solo es fatal
    // si el estilo no llegó a cargar (sin red / servidor caído), porque entonces 'load' no se dispara nunca.
    m.on('error', () => { if (!cargado) setError(true); });
    m.on('load', () => {
      cargado = true;
      m.addSource(FUENTE, { type: 'geojson', data: aGeoJSON([], []) });
      // Anillo naranja bajo el icono para la terraza elegida (filtro vacío = ninguna).
      m.addLayer({
        id: CAPA_SEL, type: 'circle', source: FUENTE, filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 19, 'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': COLOR_SEL.wave, 'circle-stroke-width': 3,
        },
      });
      // Una sola capa de símbolos (no marcadores DOM): 1665 nodos DOM irían a trompicones en móvil.
      m.addLayer({
        id: CAPA, type: 'symbol', source: FUENTE,
        layout: { 'icon-image': ['get', 'estado'], 'icon-size': 1, 'icon-allow-overlap': true },
      });
      setListo(true);
    });
    // Un clic: o cae sobre un icono (con margen táctil) o es "vacío" → deseleccionar.
    m.on('click', (e) => {
      const { x, y } = e.point;
      const f = m.queryRenderedFeatures([[x - TAP / 2, y - TAP / 2], [x + TAP / 2, y + TAP / 2]], { layers: [CAPA] });
      alElegir.current(f.length ? (f[0].properties.id as string) : null);
    });
    // El contenedor cambia de tamaño sin que cambie la ventana (p. ej. al pasar a las 3 columnas): maplibre solo escucha window.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(div.current!);
    return () => { ro.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  // 2) Iconos según el tema. updateImage si ya existen: así cambiar de tema no parpadea.
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    let vigente = true; // si el tema cambia otra vez antes de terminar, se descarta este lote
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    ESTADOS.forEach(async (e) => {
      try {
        const bmp = await cargarIcono(`${base}/marcadores/${tema}-${e}.svg`);
        if (!vigente || !mapa.current) return;
        if (m.hasImage(e)) m.updateImage(e, bmp);
        else m.addImage(e, bmp, { pixelRatio: 2 });
      } catch { if (vigente) setError(true); } // 404 o SVG corrupto: sin iconos el mapa no sirve, se avisa
    });
    return () => { vigente = false; };
  }, [listo, tema]);

  // 3) Estado por hora. setData y no setFeatureState: `icon-image` es una propiedad de
  // *layout* y feature-state solo vale en *paint*, así que el cambio de forma exige
  // regenerar los datos (1665 puntos sin horizonte: barato). Los estados llegan ya calculados
  // (App los calcula una vez); rAF cancela el pendiente si llega otro cambio en el mismo fotograma.
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    const r = requestAnimationFrame(() =>
      (m.getSource(FUENTE) as GeoJSONSource).setData(aGeoJSON(terrazas, estados)));
    return () => cancelAnimationFrame(r);
  }, [listo, terrazas, estados]);

  // 4) Resaltado de la selección.
  useEffect(() => {
    const m = mapa.current;
    if (listo && m) m.setFilter(CAPA_SEL, ['==', ['get', 'id'], seleccionId ?? '']);
  }, [listo, seleccionId]);

  // 4b) Filtro por estado (chips). Si el estilo aún no cargó no hay capa: `listo` lo cubre.
  useEffect(() => {
    const m = mapa.current;
    if (listo && m) m.setFilter(CAPA, visibles
      ? ['any', ['in', ['get', 'estado'], ['literal', visibles]], ['==', ['get', 'id'], seleccionId ?? '']] : null);
  }, [listo, visibles, seleccionId]);

  // 4c) Vuelo a la terraza elegida en el buscador.
  useEffect(() => {
    if (volarA) mapa.current?.easeTo({ center: [volarA.lon, volarA.lat], zoom: 17 });
  }, [volarA]);

  // 5) Color del anillo según el tema.
  useEffect(() => {
    const m = mapa.current;
    if (listo && m) m.setPaintProperty(CAPA_SEL, 'circle-stroke-color', COLOR_SEL[tema]);
  }, [listo, tema]);

  // 6) Los botones de zoom los crea maplibre con textos en inglés: se traducen al idioma de la app.
  useEffect(() => {
    const raiz = div.current;
    if (!raiz || !mapa.current) return;
    for (const [clase, texto] of [['zoom-in', t.zoomMas], ['zoom-out', t.zoomMenos]]) {
      const b = raiz.querySelector(`.maplibregl-ctrl-${clase}`);
      b?.setAttribute('aria-label', texto);
      b?.setAttribute('title', texto);
    }
  }, [t]);

  return (
    <>
      <div ref={div} className="ss-mapa" role="region" aria-label={t.mapa} />
      {/* Posición absoluta sobre el tile (el padre .app__mapa es relative): ocupa el hueco del mapa. */}
      {error && <p className="ss-mapa__error" role="alert">{t.mapaError}</p>}
    </>
  );
}
