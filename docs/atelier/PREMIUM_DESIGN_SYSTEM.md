# Atelier · Design System Premium Minimalista
**Propuesta v0.1 · 8 octubre 2026 · documentación; sin cambios de interfaz en producción**

## Visión
*Un vestidor privado con sensibilidad editorial y utilidad cotidiana.* Premium = claridad, fotografía consistente, buena respuesta, control y confianza. Minimalismo = decisiones visibles mínimas, no reducción de capacidades.

### Lo que ya funciona y debemos preservar
El CSS actual usa fondo cálido `#f7f5f2`, superficies blancas, texto `#171614`, Georgia en titulares, Inter/sistema en interfaz y un ancho de contenido de 760 px. Hay una navegación inferior de tres destinos, modal tipo sheet y tarjetas de prendas 4:5. **Evolucionar en vez de rehacer.** La PR paralela de «Cambiar una pieza» pertenece al equipo de estilismo; esta propuesta no modifica `atelier.js`, `atelier.css` ni la navegación existente.

## Principios
1. **La prenda manda**: fotografías más grandes que los adornos; ratio 4:5 consistente y fondo neutral.
2. **Una acción principal por pantalla**: en Hoy «Ver mis looks», Armario «Añadir prenda», Looks «Crear look». El resto secundario.
3. **Capas progresivas**: formulario básico y «Más detalles» plegable; filtros no visibles hasta solicitarlos.
4. **Accesible ≠ ornamentado**: WCAG 2.2 AA como objetivo de implementación, contraste normal ≥4.5:1 y texto grande ≥3:1, foco visible, controles cómodos, zoom 200%, tamaño de texto dinámico.
5. **Fidelidad y transparencia**: siempre identificar qué foto se presenta (original, mejorada, tienda, futura IA); nunca sustituirla silenciosamente.
6. **Sin bloqueos estéticos**: estilos diversos; neutralidad visual de la interfaz, no imponer minimalismo al armario personal.
7. **Rapidez percibida**: usar placeholders estables y progresivos, sin skeletons eternos; los resultados locales no dependen del backend.
8. **Decisiones reversibles**: los cambios de looks y fotos siempre pueden deshacerse; salvar estados parciales.

## Tokens propuestos — no implementados
| Token | Valor sugerido | Uso |
|---|---|---|
| bg | #F7F5F2 | Superficie general existente |
| surface | #FFFFFF | Tarjetas y sheets |
| surface-alt | #F0EDE8 | Separaciones suaves y filtros activos |
| ink | #171614 | Texto principal |
| muted | #655F59 | Texto secundario con contraste suficiente |
| hairline | #DDD7D0 | Bordes discretos |
| accent | #25211E | CTA principal, foco editorial |
| focus | #235C9F | Aro de foco visible y distinguible |
| success/danger | semánticos con contraste AA | Mensajes, no decoraciones |
| radius-card | 16px | Tarjetas de ropa |
| radius-sheet | 24px | Modal inferior |
| radius-control | 12px | Botón/campo |
| content-width | 760px | Vista actual (revisar tablet) |
| photo-ratio | 4 / 5 | Catálogo |

La paleta es **propuesta**; comprobar contrastes en estados hover, disabled, errores y fotos sobre fondos oscuros. Evitar contraste insuficiente de texto color gris sobre marfil.

## Tipografía y retícula
- Títulos editoriales: Georgia existente (sin fuentes de pago ni descargas) para marca, encabezado inicial y un título por vista. Inter/SF Pro/system para controles, fichas y datos.
- Escala inicial: 36 / 28 / 20 / 16 / 14 px; nunca texto operativo inferior a 14 px. Línea base legible (1.35–1.55), espaciado vertical múltiplos de 4 px.
- Grid 2 columnas móvil para armario; fotos protagonistas y texto breve. Ancho de tarjeta adaptativo en pantalla pequeña; respeta safe-area iOS. 3–4 columnas en tablet/escritorio a evaluar.
- Iconos del mismo estilo y grosor; no usar emojis como iconografía de acciones críticas sin texto.

## Componentes que conviene unificar
1. **App header**: logo y selector de perfil, no sobrecargar con ajustes.
2. **Bottom navigation**: máximo cuatro destinos visibles; propuesta conceptual Hoy / Armario / Looks / Perfil. Maletas, compras, calendario, estadísticas se ubican en accesos contextuales. **Requiere test de encontrabilidad antes de cambiar navegación.**
3. **Hero editorial**: máximo un título, una línea de contexto, una acción destacada.
4. **GarmentCard**: imagen 4:5, nombre legible, tipo/color; acciones en menú contextual; no tapar fotografía con badges.
5. **OutfitCard**: composición de fotos + ocasión + razón breve comprobable («Un acento cálido enlaza los accesorios»), feedback accesible.
6. **Filter drawer / chips**: filtros tras pulsar «Filtrar», permitir borrar; feedback del estado activo.
7. **Bottom sheet**: cierre explícito, foco gestionado, teclado móvil sin tapar botones.
8. **Estados**: vacíos útiles, guardando, error recuperable, sin conexión, foto no retocable, análisis inconcluso.
9. **Tamaño de toque**: objetivo ideal 44×44 CSS px; no depender de gestos ocultos.
10. **Motion**: 120–220 ms en transiciones discretas, respetar `prefers-reduced-motion`; no añadir movimiento por decorar.

## Tres prototipos de flujo (wireframes textuales)
### 1. Hoy — «decisión en segundos»
```text
Atelier.                                  Perfil
Buenas tardes
Tu armario, nuevas posibilidades.

[Ver tres looks para hoy]  ← CTA único principal
Contexto: Día a día · 20 °C · [Cambiar]

Recomendados para ti
[Imagen look 01] [Imagen look 02] [Imagen look 03]
«Equilibrado»  «Diferente»  «Atrevido»
[Ver por qué] [Guardar] [Cambiar una prenda*]

Acceso contextual: Preparar maleta | Planificar semana
Navegación principal
```
\* Función en desarrollo por Claude; aquí solo se describe el espacio futuro. No duplicar su implementación.

### 2. Armario — «biblioteca visual»
```text
Mi armario                         [+ Añadir]
Busca una prenda…                   [Filtros]
Todas / Arriba / Abajo / Vestidos / ... ← scroll horizontal
[Foto 4:5] [Foto 4:5]
Nombre       Nombre
Tipo         Tipo
[Foto 4:5] [Foto 4:5]
   «¿La compraste online? Puedes subir la foto de la tienda»
```
La invitación a fotos de tienda solo se muestra al añadir/editar, no en todas las tarjetas. No duplicar los avisos ya integrados.

### 3. Looks — «explorar y afinar»
```text
Looks                                [Crear]
[Para hoy] [Combinar una prenda] [Guardados]
[Collage prendas          ]
[Coherente para: Trabajo]
«El pantalón equilibra la parte superior»
[Guardar look] [Cambiar una pieza*]
Me gusta / No es mi estilo
```
La explicación solo se muestra si el motor dispone de evidencias; no inventar razones. Las propuestas muestran alternativas distinguibles, no tres permutaciones iguales.

## Usabilidad y accesibilidad
- Flujo básico: añadir foto → IA sugiere atributos → revisar → guardar. Sin solicitar más decisiones de las estrictamente necesarias.
- Formularios con etiquetas persistentes, errores junto al campo y no solo color; preservar introducción manual frente a respuestas de IA.
- Abrir/prueba con VoiceOver y Safari iOS, teclado, zoom 200%, ancho 320 px y 375 px; probar safe areas.
- Guardar y recuperar versión original de la imagen; mostrar antes/después cuando proceda.
- Evitar mensajes como «Tu figura necesita…»: recomendaciones sobre prenda y estilo, no juicio corporal.
- Respetar falta de datos: la UI no promete «100% compatible» ni puntuaciones pseudocientíficas.

## Inclusión, adopción, métricas
- Personas con pocos artículos deben recibir propuestas de calidad, sin forzar compras.
- Puede desactivarse cualquier función de IA de pago; explicitar si una acción enviará foto fuera del dispositivo.
- Métricas futuras preferiblemente calculadas localmente: tiempo para añadir primera prenda, ratio de outfits guardados/usados, tiempo para cambiar una pieza, errores de foto, ratio de retrocesos, satisfacción por perfil.
- Benchmark antes/después con tareas: (1) añadir foto de galería, (2) localizar prenda, (3) encontrar look para trabajo, (4) sustituir calzado, (5) preparar una maleta.

## Plan de implementación — PR pequeñas
1. **PR de documentación (esta):** guía y flujos, sin cambios en la app.
2. **PR de tokens y componentes:** CSS tokens, botones, campos, tarjetas, foco, contraste. Sin reorganizar navegación ni modificar estilista.
3. **PR Hoy/Armario:** jerarquía visual y estados vacíos, con screenshots/test mobile.
4. **PR Looks:** cuando se integre la PR de Claude para cambiar prendas; evitar conflictos.
5. **PR navegación contextual:** solo después de validar descubrimiento de Maletas, Compras, Calendario y Ajustes con usuarios reales.

## Criterios de aceptación del rediseño futuro
- Ninguna función actual desaparece ni queda inaccesible.
- Resultados de contraste AA comprobados; foco visible; 44 px ideal para controles táctiles.
- Validación `node atelier/validate.mjs`, Safari y Chrome en móvil.
- No añadir fuentes externas, librerías grandes ni endpoints de IA para efectos visuales.
- Capturas antes/después y posibilidad de revertir cada PR.
- PR de Claude de «Cambiar una pieza» integrada o claramente separada antes de editar vistas de looks.

**Fuentes guía:** Apple Human Interface Guidelines (https://developer.apple.com/design/human-interface-guidelines/), WCAG 2.2 (https://www.w3.org/TR/WCAG22/), NN/g Progressive Disclosure (https://www.nngroup.com/articles/progressive-disclosure/). Son referencias de principios, no aval de esta propuesta particular.
