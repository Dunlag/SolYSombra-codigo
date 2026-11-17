# Brief de diseño: Sol y Sombra (prototipo web mobile-first)

Documento para trabajar el diseño en Claude Design. Fecha: 2026-11-13. Todo lo marcado como
**decidido** lo confirmó Fernando; lo marcado como **propuesta** está pendiente de su visto bueno.

## 1. Qué es
Web/PWA que muestra en un mapa de Málaga las terrazas de bares (1665) coloreadas según estén
**al sol, a la sombra o de noche** a una hora y fecha dadas. Se usa en la calle, con sol fuerte
y con una mano. En el futuro habrá una app móvil, así que el diseño no debe depender de la web.

Es un prototipo: lleva un rótulo visible "prototipo: el modelo aún no está validado en la calle".

## 2. Las tres funciones (decidido: las tres son innegociables)
1. **Mapa sol/sombra por hora:** un marcador por terraza, selector de hora y fecha, botón "ahora".
2. **Ficha de terraza** (panel inferior): nombre, dirección, distrito, estado actual en texto,
   **hasta qué hora sigue así**, y enlace para abrirla en la app de mapas del móvil.
3. **Cerca de mí:** geolocalización y lista de terrazas con sol cercanas.

Requisito transversal (decidido): **muy bien adaptado a móvil**.

## 3. Pantallas a diseñar
- A. Mapa con panel en reposo (nombre y estado de la terraza elegida o contador "N terrazas con sol").
- B. Ficha abierta, con 3 alturas: reposo, media, completa. Botón alternativo al arrastre.
- C. Selector de hora: píldora flotante abajo con chips "Ahora / +1h / Tarde" y un slider.
- D. Cerca de mí: lista y alternancia Mapa/Lista.
- E. Geolocalización denegada: el mapa sigue centrado en Málaga, con reintentar.
- F. Estado vacío: "ninguna terraza con sol a esta hora", con frase corta y acción.
- G. Aviso de limitaciones y atribuciones (Ayuntamiento de Málaga, Catastro, OpenStreetMap).
- H. Tema claro y oscuro (propuesta: según el sistema).

La geolocalización se pide solo al pulsar el botón, nunca al cargar.

## 4. Datos que mostrará cada terraza
`nombre`, `direccion`, `distrito`, `lat`, `lon`, `metros` (campo del Ayuntamiento, su significado
está por confirmar) y, calculado: `estado` (sol, sombra o noche) y la hora hasta la que se mantiene.
El horizonte (180 valores) no se muestra: es solo para el cálculo.

## 5. Dirección visual (propuesta: "papel y tinta")
Familia de las apps de Fernando (`sitio-cli`, `conversor de imagen`) con acentos de su portfolio
Mammoth. Los colores no tienen que ser los del portfolio; interesa el estilo y la idea.

- Papel `#f2f1ed`, tinta `#0a0a0a`, rejilla de fondo suave `rgba(0,0,0,.06)`.
- Tipografía: **Anton** para títulos y la hora grande; **IBM Plex Mono** para horas y distancias;
  MAYÚSCULAS solo en etiquetas, no en nombres de bares ni en texto largo.
- Bordes de 3 px, esquinas rectas o píldora, sombra dura (ej. 4px 4px 0 tinta), sin blur.
- Foco visible de 3 px. Zonas táctiles de al menos 48 px.
- Tema oscuro: papel `#0b0b0d`, tinta `#f4f1ff`.
- Mapa base **desaturado** (decidido): estilo positron de OpenFreeMap, para que destaquen los marcadores.
- **Idioma:** español e inglés desde el principio (decidido).

### Estados (forma + color + palabra; nunca solo color)
| Estado | Marcador | Relleno | Contorno |
|---|---|---|---|
| Sol | círculo con rayos | amarillo `#ffe81a` | tinta 3 px |
| Sombra | cuadrado | azul `#1f3de0` | tinta o halo blanco |
| Noche | rombo con luna | tinta `#0a0a0a` | halo blanco 1,5 px |

Contrastes **calculados** (WCAG, sobre teselas de ejemplo; hay que repetirlos con el positron real):
azul sobre mapa 4,7 a 6,6; amarillo sobre mapa 1,0 a 1,3 (por eso necesita contorno de tinta; contra
la tinta da 15,9); tinta sobre mapa 12 a 17,5. Naranja, magenta y menta (2,0 a 3,2) no sirven como
relleno de estado sobre el mapa.

## 6. Qué NO hacer
- Texto con opacidad 40-60 % o grises medios (ilegibles al sol).
- Titulares de más de ~48 px de alto en móvil, letras deformadas en datos (hora, nombre del bar).
- Efectos WebGL, glitch, cursor propio, preloader o scroll con efectos: compiten con los gestos del mapa.
- Depender solo del color para el estado (WCAG 1.4.1) o de arrastrar sin alternativa (WCAG 2.5.7).
- Marcadores DOM pesados: en la implementación serán una capa de MapLibre.

## 7. Referencias (leídas por subagentes; solo texto y CSS, no vieron móvil real)
- Zonnie (zonnie.app): chips "Ahora/Tarde/Noche" más scrubber, y línea horaria de sol en la ficha.
- ShadeMap (shademap.app): slider de hora abajo con actualización en vivo.
- Brrranding: Camp Yerba (iconos de sol/luna), Union (iconos geométricos sobre color sólido),
  Piedmont Art Walk (señalización de calle), Toomato (microcopy con humor), MoMA PS1 Warm Up (condensada enorme).
- Siteinspire: Funner (paleta plana saturada), Idle (píldora flotante), Outlign (chips de estado con texto).
- Sin verificar: patrones reales de Google Maps, Citymapper, Material 3 y Sun Seeker en un teléfono.

## 8. Decisiones abiertas para Claude Design
1. Forma exacta de los tres marcadores (la tabla es una propuesta).
2. ¿Línea horaria completa del día en la ficha, o solo "hasta qué hora"?
3. ¿Marcar "sol parcial" o mantener tres estados?
4. Agrupación de marcadores (clusters) a bajo zoom: indicador y zoom de corte.
5. Logotipo y favicon (el nombre "Sol y Sombra" es de trabajo; nombre y dominio se deciden antes de publicar).

## 9. Entregables que se piden a Claude Design
- Pantallas A a H en móvil (ancho 390 px de referencia) y una vista de escritorio simple.
- Tokens exportables: colores, tipografía, espaciado, bordes, sombras (en CSS custom properties).
- Los tres marcadores como SVG (24 y 48 px) y el icono de la app.
- Anotaciones de interacción: alturas del panel, comportamiento del slider, estados vacío y de error.

## 10. Fuera de alcance
Cuentas de usuario, reseñas, capa visual de sombras, otras ciudades, monetización, SEO y páginas
por terraza (fase 2).
