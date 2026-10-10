# Auditoría de brechas entre Atlas y Atelier — 10/10/2026

**Fuente revisada:** `atelier/atelier.js` en `main` (constantes `ANALYSIS_FIELDS`, `META_FIELDS`, `cleanAnalysis`, `normalizeData`) y `atelier-api/api/analyze.js` (prompts de análisis individual y de look). **Alcance:** auditoría de esquema y capacidad de captura; las observaciones sobre uso algorítmico requieren contraste posterior de las funciones de ranking. Ninguna afirmación de precisión visual sin evaluación etiquetada.

## Hallazgo principal

La ficha es un buen punto de partida, pero mezcla categorías ontológicas incompatibles: `fabric` contiene fibras (`cotton`, `wool`), construcción (`knit`), tejido (`denim`), ligamento/apariencia (`satin`) y materiales (`leather`). `pattern` solo permite un valor entre `plain/stripes/checks/floral/animal/dots/graphic/other`: no expresa motivos simultáneos, escala, densidad, ubicación, acabado ni lavado. `fit` tiene seis opciones, `length` solo cuatro largos más `na`; no expresan pernera, tiro, estructura, rigidez o drapeado.

La IA para prenda individual recibe un vocabulario mucho más reducido que el atlas; la IA de look completo devuelve aún menos detalles visibles. `cleanAnalysis` permite únicamente los atributos predefinidos como `ia`, y descarta propuestas fuera de los vocabularios, por lo que **agregar términos al prompt sin actualizar validación y edición no funcionaría**.

## Matriz de correspondencia

| Dimensión | Hoy en Atelier | Brecha de decisión | Prioridad y método |
| --- | --- | --- | --- |
| Categoría | `CATEGORIES` con Arriba, Abajo, Vestidos, Capas, Zapatos, Bolsos, Accesorios, Casa, Baño | roles múltiples (chaleco top/capa, camisa abierta), conjuntos coordinados | P2: derivar roles contextuales, sin pedir nueva ficha |
| Tipo concreto | `subtype` texto y `garmentType` IA | subtipo granular, hombros, cierres, construcción | P2: derivación local con corrección manual |
| Color | principal + `secondaryColor`; nombres discretos | patrón multicolor, reparto por zonas, intensidad y luminosidad | P1: análisis local aproximado con bandera de confianza |
| Estampado | `pattern` único de 8 valores | motivos múltiples, escala, densidad, cobertura, ubicación y contraste | **P1**: ampliar solo lo útil tras evaluación |
| Denim | `fabric=denim`, tipo vaqueros y `details` libre | wash, abrasión, patchwork, bordado, motivo real | **P1**: separar lavado de motivo |
| Fibra/tejido | `fabric` mixto y `composition` manual | fibra vs construcción vs acabado | **P1**: subcampos compatibles, no migrar destructivamente |
| Silueta | `fit` y `length` | volumen, drapeado, tiro, pernera, estructura | P1/P2: añadir según discriminación real |
| Cobertura/temperatura | `sleeve`, `thickness`, `warmth`, `season` | viento, lluvia, forro, actividad y error de estimación | P0: conservar advertencias y fiabilidad |
| Ocasión | `formality`, `occasions`, `style` | código de vestimenta, entorno y actividad concreta | P1: contexto dinámico antes que nuevas etiquetas |
| Detalles | `details` texto libre | datos clave no comparables estructuralmente | P2: extraer señales cuando aporte |
| Confianza | `confidence` global alta/media/baja | confianza por atributo; desconocido ≠ liso | **P0**: no asumir certeza en valores faltantes |
| Accesorios y calzado | categorías, tipo y metadatos genéricos | altura, estructura, caminabilidad, tamaño visual | P2: atributos selectivos de impacto |
| Feedback/perfil | preferencias y feedback existentes | distinguir preferencia estética temporal de regla general | P1: contextualizar, no contaminar hechos |

## Errores que conviene prevenir

1. `fabric=satin` y `fabric=silk` no son excluyentes conceptualmente: el satén puede tejerse con distintas fibras.
2. `fabric=knit` y `fabric=wool` tampoco: lana puede ser de punto o tejido plano.
3. `pattern=plain` no debe derivarse de campo ausente: desconocido no significa liso.
4. Vaqueros acid wash, estampados y bordados no se deben tratar como fondo visual uniforme solo por `fabric=denim`.
5. Prenda `oversize` no indica que todas las prendas con ella deban ser ajustadas.
6. `formality` por prenda no equivale al registro resultante del look completo.
7. No deducir fibras exactas ni comodidad física por imagen; `composition` manual tiene mayor valor para material real.
8. La etiqueta de ocasión generada por IA puede ser equivocada; no bloquear permanentemente una prenda por inferencia incierta.
9. Los motivos pueden combinar cromáticamente pero fallar por tejidos, caída, volumen, calzado y ocasión.

## Plan de implementación comprobable

**Fase A (sin cambio visual):** auditar un conjunto de fichas reales/consentidas con una pequeña tabla de verdad: `fiber`, `weaveOrKnit`, `wash`, `patternPlacement`, `patternScale`, `drape`. Contar por campo: se ve claramente / no se ve / ambiguo / error habitual. No añadir campos que la IA no pueda reconocer ni que la persona no pueda corregir.

**Fase B (compatibilidad de datos):** diseñar un campo opcional `materialAttributes` o estructura equivalente, manteniendo `fabric`, `pattern` y `details` existentes para versiones antiguas. Definir normalización de valores, alias y `unknown` explícito. Nada de deducciones invasivas por género. Validar edición, exportación/importación, sincronización, invalidación de relaciones y correcciones por usuario.

**Fase C (motor):** integrar señales en `pairEvidence` y contexto dinámico en `contextualizePair`; `comboIdentity` debe reevaluar globalmente caída, estructura, foco, ocasión y clima. Comparar ganancia respecto al baseline, evitando segundo scoring independiente o pesos arbitrarios que falseen estilos expresivos.

**Fase D (prueba humana):** reservar looks completos no vistos de distintos estilos (incluidos masculinos y mixtos), denim lavado/estampado, materiales contrastantes, siluetas relajadas y eventos. Un conjunto mejor etiquetado pero sin mejora estética no justifica más campos.

## Siguiente PR funcional sugerida

Primero **pruebas de clasificación y validación de metadatos**, no 30 opciones nuevas en la UI. Mantener interfaz minimalista y coste IA bajo. Solo después conectar al motor atributos que demuestren beneficio en casos adversariales.

**Importante:** el atlas PR #220 es el mapa conceptual; este documento separa lo ya capturado de lo que aún está ausente. No fusionar cambios documentales pendientes de validación y revisión cruzada.
