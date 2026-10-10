# Atelier — Estudio de combinación de estampados y denim (10/10/2026)

> Documento de investigación aplicado al motor estilista. **No es un listado de prohibiciones ni una implementación aprobada.** Separar observaciones de estilismo, hipótesis de ranking y validación humana; respetar preferencias de cada perfil sin presuponer género.

## Resumen ejecutivo

**Adoptar como modelo de datos:** separar `fabric=denim` de `pattern`, `wash`, `finish` y `decoration`; poder registrar múltiples motivos y su ubicación. Un vaquero lavado ácido no equivale a uno liso, y un vaquero con flores es simultáneamente denim y floral.

**Adoptar como criterio de composición:** las combinaciones de estampados se evalúan en el look entero, con contexto, contraste, tamaño/densidad, superficie ocupada, paleta, proporción y punto focal. **Nunca convertir rayas+cuadros, animal print+flores ni doble denim en vetos universales.**

**Experimentar:** atributos visuales normalizados, peso visual aproximado, un punto focal dominante si el perfil prefiere equilibrio, selección de combinaciones por intención (clásica/expresiva) y pruebas A/B nuevas con looks completos. No imponer una cantidad máxima absoluta de estampados: es una decisión estética.

**No hacer:** clasificar todo el denim como `plain`; contar lavado/desgaste y motivos impresos como lo mismo; inferir automáticamente gusto o género por un perfil; aprobar dos estampados solo por compartir color; penalizar cada par sin evaluar la composición global.

## 1. Dimensiones independientes de un estampado

| Variable | Ejemplos | Para qué importa |
| --- | --- | --- |
| Familia | rayas, cuadro/vichy/tartán, flores, lunares, animal, paisley, geométrico, abstracto, camuflaje, letras, ilustración | Relaciones de formas y asociaciones estéticas |
| Escala | micro, pequeña, mediana, grande, mixta | Competencia o diálogo entre motivos |
| Densidad | dispersa, moderada, tupida | Cantidad de ruido visual, distinta de escala |
| Contraste | bajo, medio, alto | Foco y relevancia visual |
| Paleta | fondo, 1–3 tonos dominantes y acentos | Puentes de color; no obligatoriedad de color compartido |
| Distribución | all-over, local, bordes, paneles, degradado | Superficie realmente visible |
| Regularidad | repetitivo geométrico, orgánico, irregular | Ritmo y jerarquía |
| Acabado | brillo, mate, textura, relieve, bordado, desgaste | El estampado puede ser también textura |
| Confianza | comprobado, estimado, desconocido | Evita inferencias falsas a partir de una foto |

Reglas de trabajo (todas **blandas**, salvo requisitos funcionales del contexto):
- **Escalas diferentes** suelen ayudar a jerarquizar, pero mismo tamaño puede funcionar para un total look intencional.
- **Un color común** puede vincular, pero dos estampados sin tonos comunes también pueden lograr contraste dirigido.
- **Uno protagonista, otro apoyo** es un buen modo equilibrado, pero no hay que anular el maximalismo.
- **Una superficie reducida** de un segundo estampado (pañuelo, calzado) modifica la percepción; un motivo minúsculo tupido no es necesariamente discreto.
- **Examinar la pieza dentro del conjunto**: dos pares aceptables no garantizan una combinación de cuatro prendas coherente.
- **Contexto + gusto**: trabajo formal, ocio creativo, evento y perfil no equivalen.

## 2. Denim: tejido, lavado, motivo y detalles no son el mismo atributo

| Grupo | Ejemplos | Interpretación para Atelier |
| --- | --- | --- |
| Denim uniforme | índigo liso, negro, blanco, crudo | `fabric=denim; pattern=plain; wash=clean` (si evidencia) |
| Lavados | claro/medio/oscuro, stonewash, acid wash, snow/marbled, degradado, desteñido por zonas | `wash` independiente; textura visual y contraste por zonas |
| Marcas de uso | whiskering, bigotes, abrasión, rodillas desgastadas, rotos, flecos | `finish` / `distressing`; afecta ocasión, no necesariamente patrón |
| Diseño constructivo | patchwork, paneles bicolor, costuras contrastantes, reconstruido | `construction` o `decoration`; puede formar motivo geométrico |
| Motivos impresos | rayas, flores, lunares, animal print, bandana, camuflaje, paisley, gráficos, efecto trampantojo | `pattern` específico **además** de `fabric=denim` |
| Bordados y apliques | flores bordadas, piedras, parches, tachuelas | `decoration` con cobertura/localización; no suponer all-over |
| Texturas del tejido | jacquard con dibujo, relieve, recubrimiento metalizado | `weavePattern` / `surface`, si se reconoce |

**Casos guía**:
- Jeans azul índigo uniforme + camisa de rayas: denim base, las rayas pueden protagonizar.
- Jeans acid wash intenso + camisa de microcuadros: puede funcionar, pero el lavado ya añade actividad visual; comprobar contraste y densidad.
- Jeans con rosas bordadas localizadas + camiseta de rayas finas: mezcla permitida; el área floral localizada importa.
- Jeans all-over con leopardo + abrigo de cuadros grandes: evaluarlo como dos motivos fuertes, no «vaquero neutro».
- Chaqueta vaquera clara + pantalón índigo oscuro: double denim por contraste tonal.
- Camisa y pantalón vaqueros del mismo lavado: total look deliberado; no penalizar por semejanza.
- Denim con paneles patchwork + prendas neutras: los paneles pueden ser protagonistas aunque `pattern=plain` sea cierto en cada panel.
- Denim estampado zebra + prendas a rayas: dos motivos lineales pueden reforzarse o competir según escala, orientación, contraste y contexto.

## 3. Matriz de familias (puntos de partida, no reglas absolutas)

| Mezcla | Hipótesis favorable | Riesgo que se debe comprobar |
| --- | --- | --- |
| Rayas + flores | ritmo regular frente a orgánico, paleta enlazada | dos motivos muy densos con igual peso |
| Cuadros + flores | geometría frente a motivo orgánico | alto contraste y área grande en ambas |
| Rayas + lunares | diferencia de forma, variación de escala | micro-motivos tupidos vibrantes |
| Animal + rayas | contraste intencional; animal como acento | exceso de focos en zonas centrales |
| Animal + animal | continuidad temática, variación controlada | colores/escala/contexto incoherentes |
| Flores + flores | motivos de distinta escala y fondo compatible | dos dibujos dominantes que no crean jerarquía |
| Cuadros + cuadros | coordinación de color o variación de escala | falso conjunto cuando solo coinciden colores |
| Denim lavado + estampado | lavado suave como textura, estampado principal | lavado ácido fuerte tratado como liso |
| Denim estampado + otro estampado | contraste o repetición deliberada | denim clasificado incorrectamente como neutro |
| Denim + denim | mismo acabado o contraste de lavados pueden funcionar | diferencias no intencionales de tono/acabado |

## 4. Propuesta de campos (borrador, no migrar la ficha sin validación)

```json
{
  "fabric": "denim",
  "pattern": "floral",
  "patternSecondary": "stripe",
  "patternScale": "medium",
  "patternDensity": "sparse",
  "patternContrast": "high",
  "patternPlacement": "localized",
  "baseColor": "blue",
  "patternColors": ["white", "pink"],
  "wash": "medium-indigo",
  "finish": ["distressed"],
  "decoration": ["embroidery"],
  "attributeConfidence": {"pattern": "confirmed", "patternPlacement": "inferred"}
}
```

Los campos deben ser optativos, explicables y corregibles. Preferir una evolución compatible con `META_FIELDS` y los datos ya sincronizados. Si `pattern` está vacío no significa liso; si el usuario confirma un dato, prevalece ante IA. **No inventar precisión numérica de superficie de motivo desde una foto sin segmentación.**

## 5. Algoritmo de hipótesis sin «prohibiciones por parejas»

1. Recuperar atributos fiables y marcar los ausentes; no duplicar la lógica de `pairEvidence/contextualizePair/comboIdentity`.
2. Calcular para cada look candidato el **peso visual aproximado** de motivos teniendo en cuenta tamaño de la prenda visible, densidad, contraste, saturación y posición (sin usar peso corporal ni inferencias sobre género).
3. Reconocer estrategia posible: `coordinated`, `balanced-contrast`, `expressive-clash`, `tonal`, `matching-set`, `single-focus`. Son etiquetas explicativas tentativas, no notas fijas.
4. Revisar coherencia global: paleta, ritmo, zonas protagonistas, corte, formalidad y clima. Penalizar un choque observado y explicable, **no** la mera existencia de dos estampados.
5. Incorporar preferencia del perfil y ocasión al reranking; conservar alternativas expresivas si son buenas.
6. Explicar con señales existentes («rayas discretas y flores localizadas», «diferencia de lavados»), no «combina al 93 %» ni supuestos basados solo en nombres.

## 6. Batería de evaluación con looks completos — nuevos casos

Conservar como conjunto de **desarrollo**, no usar sus respuestas para validar el motor que se ajuste con ellas. Preparar después un conjunto **ciego e independiente** con prendas reales de varios perfiles.

| ID | Comparación a evaluar | Qué medir |
| --- | --- | --- |
| P01 | rayas finas + floral grande frente a rayas finas + floral pequeño tupido | escala × densidad |
| P02 | cuadros + flores con color puente frente a sin puente, pero contraste intencional | no usar color como veto |
| P03 | rayas + leopardo con animal solo en bolso frente a animal en pantalón | superficie de foco |
| P04 | dos estampados florales con misma paleta frente a paletas distintas | continuidad y creatividad |
| P05 | dos estampados grandes armoniosos frente a un tercero innecesario | beneficio marginal |
| P06 | denim uniforme con camisa estampada frente a acid wash intenso con la misma camisa | lavado no equivale a liso |
| P07 | jeans florales bordados localizados frente a jeans florales all-over, misma camiseta | posición/cobertura |
| P08 | vaquero de rayas + top floral, contexto diario y formal | ocasión |
| P09 | double denim con igual tono/lavado frente a tonos contrastados | no veto universal |
| P10 | denim patchwork bicolor + chaqueta geométrica frente a top liso | estructura visual |
| P11 | denim animal print + abrigo de cuadros con dos escalas distintas | conjunto expresivo |
| P12 | conjunto masculino/andrógino/femenino con las mismas prendas posibles | no género como filtro |
| P13 | usuario que prefiere maximalismo frente a usuario de estética minimalista | gusto por perfil |
| P14 | foto sin metadatos de estampado frente a etiqueta corregida | confianza y degradación |
| P15 | vestido estampado + capa con estampado necesario por frío | clima y alternativa honesta |
| P16 | jeans con flores + cinturón llamativo sin ganancia frente a look sin cinturón | opcionalidad |

**Protocolo:** mostrar fotografías y contexto sin puntuación del sistema; votar A/B/ambos/ninguno/insuficiente; motivo opcional (color, escala, contraste, proporción, contexto, gusto); evaluar variedad y estética por separado; no ajustar reglas y certificar con los mismos ejemplos. Reportar desacuerdos como diversidad de gustos, no necesariamente «fallos».

## 7. Integración segura con Atelier

- Antes de programar, auditar `META_FIELDS`, `pattern`, `fabric`, `lookIssues`, `pairEvidence` y `comboIdentity` en **main actual**, porque el documento de #159 revisó una versión anterior.
- Implementar primero **etiquetado y tests**, sin sustituir el ranker ni la lógica climática.
- El cambio de `/api/analyze` debe medir precisión en lavados, bordados y estampados, cuidando gasto de tokens. Evitar pedir a IA diez campos que no puede observar con fiabilidad.
- El criterio de denim liso debe activarse únicamente cuando se confirme ausencia de motivo; separar desconocido de liso.
- Seguir normas de `AGENTS.md`: rama, validación, PWA cache si cambia `atelier/`, revisión cruzada con Claude.
- Evitar datos de imagen o perfil en logs de benchmark y ninguna clasificación por género inferido.

## 8. Fuentes y limitaciones

- Levi's España, *Diccionario denim*: terminología de lavado ácido, tono, desgaste y acabados: https://www.levi.com/ES/es_ES/features/denim-dictionary
- Vogue España, *Fiebre por lo vaquero / double denim* (2025), combinaciones de tonos y lavados: https://www.vogue.es/articulos/tejido-vaquero-double-denim-brooklyn-beckham-nicola-peltz-tendencias-2025
- British Vogue, *How To Style Head-To-Toe Denim In 2026*: https://www.vogue.co.uk/article/double-denim-trend
- Vogue, *Print! Pattern! Color! ... Can Clashing Be Tasteful?* (2026), experimentación de estampados: https://www.vogue.com/article/street-style-clashing-prints-patterns
- Style Walkthrough, *How to Mix Prints in an Outfit* (2026), escala, densidad, superficie y color: https://stylewalkthrough.com/blog/how-to-mix-prints-in-an-outfit
- Vogue España, *50 sombras de azul*, ejemplos de estampados y denim: https://www.vogue.es/moda/tendencias/galerias/combinar-denim-colores-vaqueros/13605

Las publicaciones de moda son ejemplos editoriales, no estudios cuantitativos que demuestren un algoritmo. Las variables y casos de prueba de este documento son **propuestas para investigación y validación**, no fórmulas certificadas.
