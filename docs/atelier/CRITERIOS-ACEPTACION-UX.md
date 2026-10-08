# Atelier · Matriz de aceptación visual y accesibilidad (Fase C)
**9 oct 2026 · Responsable ChatGPT/Codex · Coordinación issue #40**

Este documento traduce `PREMIUM_DESIGN_SYSTEM.md` y los hallazgos D1–D12, A1–A2 de `AUDITORIA-2026-10-09.md` en comprobaciones reproducibles. **No modifica comportamiento**. Antes de ejecutar Fase C Claude debe liberar `atelier.js` tras Fase B. Ninguna función desaparece.

## Escenarios de datos obligatorios
- **E0:** perfil recién creado, armario vacío, sin looks, sin planes ni gastos.
- **E1:** 21 prendas de fotografías reales con fondo variable, nombres duplicados, looks completos e incompletos, plan hoy/mañana, viaje, wishlist y usos.
- **E2:** 100 prendas de colores/patrones/ocasiones diversos y algunas sin foto.
- **E3:** 300 prendas, 150+ usos y 30 looks, para test de latencia/memoria con fotos realistas.
- **E4:** error 401, 429, 500, sin red, geolocalización denegada, carga fotográfica fallida, almacenamiento próximo al límite.
- **E5:** cambio de perfil Noelia → Irene; ninguna imagen, look, plan o contenido de perfil anterior permanece visible.

## Matriz de dispositivos
| Tipo | Tamaño CSS / preferencia | Verificar |
|---|---|---|
| iPhone compacto | 320 × 568 | 5 pestañas, textos, campos y modales sin clipping ni scroll horizontal |
| iPhone pequeño | 375 × 667 | barra inferior, safe-area, teclado y sheets |
| iPhone estándar | 390 × 844 | look del día, foto, tres propuestas, scroll |
| iPhone amplio | 430 × 932 | densidad visual y composición |
| iPad | 768 × 1024 | layout sin columnas estiradas, foco/teclado |
| Escritorio | 1280 × 800 | ancho máximo, fotos y modal |
| Texto aumentado | Zoom 200% y ajustes de texto iOS | ninguna acción esencial oculta, navegación utilizable |
| Accesibilidad | VoiceOver/teclado | orden, nombre/estado, foco en sheets y retorno, Escape |

## Contratos UI por zona
### Barra inferior y perfil
- [ ] Las 5 etiquetas Hoy / Armario / Estilista / Maletas / Compras están completas en 320 px y no requieren gestos ocultos.
- [ ] Icono comprensible y consistente por área; estado activo con color, texto y atributo `aria-current`, nunca solo color.
- [ ] Botón de perfil expone nombre y acceso explícito Ajustes; cierre de sesión limpia UI privada.
- [ ] Tap target ideal ≥44 × 44 CSS px para controles principales; contraste AA y foco visible.
- [ ] Navegación rápida entre secciones y regreso no pierde el borrador ni los planes.

### Hoy
- [ ] Lo primero es el look del día (o estado vacío accionable); fotos de prendas propias sin inventar recortes.
- [ ] «Me lo he puesto» solo registra uso al confirmarlo. Planificar no altera estadísticas.
- [ ] Cambiar prenda conserva las demás piezas del look; «Otro» muestra diversidad cuando el armario lo permita.
- [ ] Accesos «Mi semana», mañana y «Personalizar» funcionan con datos vacíos y completos.
- [ ] Fallo meteorológico conserva propuesta local y comunica incertidumbre sin fingir pronóstico.

### Armario y fichas
- [ ] Fotos 4:5 siempre; aspecto fiel a originales y fondos variables.
- [ ] Tarjeta: foto + nombre reconocible; acciones secundarias accesibles sin tapar imagen.
- [ ] Nombres iguales se distinguen con miniatura + atributo adicional disponible, nunca inventado.
- [ ] Entrar en ficha muestra foto primero; editar conserva original/fondo alternativo y nunca dispara IA sin necesidad.
- [ ] Filtros activos identificables; restablecer; scroll no salta tras guardar.
- [ ] Listas olvidadas/estadísticas/historial incluyen miniaturas; precios ausentes no equivalen a 0€.

### Estilista, Looks y Mi semana
- [ ] Composición visual con fondo unificado y modo definido por prenda: `white-verified`, `uncertain`, `missing`.
- [ ] Propuesta con razón verificable o ninguna razón; no adornar con texto inventado.
- [ ] Tres looks no son clones de zapatos/capas si hay alternativas válidas.
- [ ] Generación IA muestra estados pendiente/éxito/cupo/error; propuestas revisables antes de guardar (dependencia Claude E6).
- [ ] Cambiar una prenda no modifica otros looks ni planes; se puede cancelar.
- [ ] Mi semana muestra estados planificado/usado; navegación semanal y fechas sin falsa marcación de uso.

### Maletas
- [ ] Listado inicial usa miniaturas, fechas, progreso de preparación y acceso claro.
- [ ] Se puede crear, editar, regenerar, añadir, quitar, marcar y desmarcar sin perder cambios.
- [ ] Elementos extras de viaje se diferencian visualmente de las prendas del armario.
- [ ] Carga/sin conexión no impide ver maleta guardada localmente.

### Compras y análisis
- [ ] «¿Lo compro?» presenta pruebas visuales de compatibilidad/duplicados, no afirmaciones tajantes sin evidencia.
- [ ] Wishlist accesible, pendiente/comprado distinguibles, precios/budget nunca confundidos con hechos si faltan.
- [ ] Estadísticas sin datos se omiten o explican; no se afirma que una prenda nunca se usó por ausencia de registro.

## Criterios de foto y composición D1
1. Original sin fondo blanco verificado: mostrar en tarjeta uniforme con recorte conservador de contenedor, no segmentación forzada.
2. Blanco verificado: fondo transparente/blanco homogéneo, escala por proporción de prenda y perspectiva, sin deformación.
3. Ausente: placeholder con nombre de categoría y texto accesible, no espacio roto.
4. Fotos mixtas: composición uniforme *a nivel de presentación*, no collage de habitaciones.
5. Los valores de píxel/colores reales jamás se reemplazan por colores «que combinan»; la fotografía es dato.

## PR visual: plantilla de descripción
- Hallazgos tratados: D#/A#/UX#
- Zonas modificadas y propietario coordinado (#40)
- Evidencia antes/después (capturas reales con E1, E0)
- Anchos probados: 320, 375, 390, 430, 768; texto 200%
- Estado de Chrome/WebKit + pruebas regresión de navegación
- Pruebas de perfil, sin conexión y fotos
- Accesos/funciones conservados (evidencia explícita)
- Cambios de API/contratos de datos: ninguno salvo acuerdo con Claude
- Cache SW incrementada cuando cambie `atelier/`
- Fusión automática según AGENTS.md, respetando despliegues limitados Vercel.

## Dependencias y orden
1. Claude termina Fase B y comunica liberación de `atelier.js` en issue #40.
2. V1: tokens, iconos, nav, semántica y foco (sin alterar rutas).
3. V2: tarjetas de fotos y composiciones (D1,D4,D5,D6).
4. V3: portadas y formularios de Hoy/Armario/Estilista (D7–D10).
5. V4: Maletas, Compras, Análisis y estados vacíos.
6. V5: auditoría final de dispositivos + accesibilidad + E0–E5.

**Criterio de salida:** ningún hallazgo de prioridad alta sin resolver, cada ruta principal probada, fotos fieles y sin pérdida de datos o funcionalidad.
