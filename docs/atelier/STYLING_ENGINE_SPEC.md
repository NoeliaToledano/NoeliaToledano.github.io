# Atelier — Manual de estilismo y especificación del motor de outfits
**Versión:** 0.1 · **Estado:** propuesta para validación, sin cambios en el motor de producción · **Fecha:** 2026-10-08

## 0. Alcance y nivel de evidencia
Este documento distingue:
- **[A] Principio de diseño**: fundamentado en material docente institucional (FIT) o teoría cromática descrita por Adobe. No equivale a una regla universal de buen gusto.
- **[E] Heurística editorial**: interpretación estilística contrastable (The Concept Wardrobe). Admite excepciones y nunca constituye una prohibición absoluta.
- **[I] Hipótesis de ingeniería**: decisión de producto todavía NO validada con usuarias ni estilista.
- **[R] Investigación de sistemas**: método para aprender compatibilidad y evaluación de outfits en publicaciones revisadas.

La fuente documenta el principio, **no valida nuestros pesos, umbrales ni fórmulas**. Deben calibrarse con evaluaciones humanas. Prohibido inferir que una prenda «favorece» a una persona por su anatomía o género; no clasificamos cuerpos. Las preferencias de cada perfil prevalecen sobre tendencias o convenciones.

## 1. Fuentes verificadas y aplicación
| ID | Fuente | Aporte concreto | Límites |
|---|---|---|---|
| S1 | Museum at FIT, *Elements and Principles of Fashion Design* — https://www.fitnyc.edu/museum/documents/elements-and-principles-of-fashion-design.pdf | Equilibrio, proporción, énfasis y ritmo visual; [A] | Principios de diseño, no reglas computacionales listas para producción. |
| S2 | Adobe Color, rueda de color — https://color.adobe.com/create/color-wheel | Armonías monocromática, análoga, complementaria y triádica; [A] | No determina por sí sola si el conjunto funciona. |
| S3 | The Concept Wardrobe, *Add Patterns & Prints* — https://theconceptwardrobe.com/build-a-wardrobe/step-6-add-patterns-prints | Escala, densidad, contraste, paleta, mezclas de estampados; [E] | Consejos editoriales; evitar afirmaciones prescriptivas sobre cuerpos. |
| S4 | The Concept Wardrobe, *Planning Your Ideal Wardrobe* — https://theconceptwardrobe.com/build-a-wardrobe/the-theory-planning-your-ideal-wardrobe | Articulación entre estilo personal, colores, tejidos, calzado y accesorios; [E] | Es un marco de armario personal, no una prueba objetiva. |
| S5 | Vasileva et al., ECCV 2018, *Learning Type-Aware Embeddings for Fashion Compatibility* — https://openaccess.thecvf.com/content_ECCV_2018/html/Mariya_Vasileva_Learning_Type-Aware_Embeddings_ECCV_2018_paper.html | Distingue similitud y compatibilidad entre tipos de prenda; evaluó 68.306 outfits; [R] | Datos de Polyvore, sesgos culturales y temporalidad. |
| S6 | Sarkar et al., WACV 2023, *OutfitTransformer* — https://openaccess.thecvf.com/content/WACV2023/html/Sarkar_OutfitTransformer_Learning_Outfit_Representations_for_Fashion_Recommendation_WACV_2023_paper.html | Compatibilidad del conjunto completo y recuperación de complemento para un look parcial; [R] | No es un módulo instalable sin adaptación ni evaluación. |
| S7 | Selwon & Szymański, *A Review of Explainable Fashion Compatibility Modeling Methods*, ACM Computing Surveys 2024, DOI:10.1145/3664614 — https://doi.org/10.1145/3664614 | Explicabilidad, reproducibilidad, datasets y sesgos; [R] | Review metodológica, no criterios universales de estilismo. |
| S8 | Schloss & Palmer (2011), *Aesthetic response to color combinations: preference, harmony, and similarity*, Attention, Perception & Psychophysics — https://palmerlab.berkeley.edu/pdf/Schloss&Palmer(2011).pdf | Evidencia empírica: la armonía sube con la similitud de matiz; los complementarios se valoran menos armónicos que sus vecinos; la preferencia sube con el contraste de claridad (claro sobre oscuro); la armonía, con menos saturación; [A] | Parejas de colores planos en pantalla, no prendas ni conjuntos completos. |
| S9 | MasterClass, *How to Mix Prints and Patterns* — https://www.masterclass.com/articles/how-to-mix-prints-and-patterns-to-create-a-stylish-outfit | Escalas distintas, color compartido y ancla neutra al mezclar estampados; [E] | Consejo editorial. |
| S10 | Stitch Fix, *Wear navy and black together* — https://www.stitchfix.com/men/blog/ask-a-stylist/wear-navy-and-black-together/ | Marino + negro con contraste visible; [E] | Consejo editorial. |
| S11 | Eileen Fisher, *Three Easy Proportions* — https://www.eileenfisher.com/a-sustainable-life/journal/a-simple-wardrobe/three-easy-proportions.html | Regla de tercios, mitad y mitad, capa larga sobre base corta; [E] | Marca de ropa; consejo editorial. |
| S12 | Lauren Conrad, *How to Wear Mixed Metallics* — https://laurenconrad.com/?p=38613 | Metalizado protagonista con neutros; mezcla de metales en detalles; [E] | Consejo editorial. |
| S13 | Outfit Narrative, *Simple color theory for casual outfits* — https://outfitnarrative.com/menswear/simple-color-theory-for-casual-outfits | Neutros de vestuario (marino, oliva), complementario como acento; [E] | Blog editorial. |
| S14 | FashionBeans, *Outdated style rules you should break* — https://www.fashionbeans.com/article/outdated-style-rules-should-break/ | «Nunca negro con marrón / marino» como norma obsoleta; [E] | Opinión editorial. |

## 2. Contrato del producto
1. Recomendar **solo prendas existentes** del perfil, sin inventar piezas. Cuando falte algo, expresar «no hay alternativa adecuada»; las compras son otra función.
2. Soportar estilos mezclados y distintos objetivos: conservador, equilibrado, creativo, atrevido; el **estilo deseado** cambia la ponderación del look.
3. Verificar ocasión, clima y función antes de estética; las 8 ocasiones UI son: Día a día, Trabajo, Deporte, Playa y piscina, Estar en casa, Eventos y celebraciones, Fiesta y salir, Formal. «Viaje» es un contexto de maleta, no una ocasión.
4. **No incluir ropa interior como prenda catalogada**. Pijamas/Casa sí; la lista de maleta puede incluir recordatorio de ropa interior sin ficha.
5. Diversidad real: 3 looks distintos no deben limitarse a cambiar un bolso. Promover descubrimiento, pero no sacrificar compatibilidad.
6. Mostrar el **porqué** con criterios verificables: «la parte superior ajustada contrasta el volumen del pantalón», en vez de «te queda genial» sin pruebas.
7. Nunca asumir medidas corporales, género, etnia, colorimetría facial ni ajuste sobre la persona a partir de la foto de una prenda.
8. Cada perfil tiene preferencias y feedback propios. Poder bloquear prendas, evitar repeticiones y exigir una prenda concreta.
9. Primera versión **local, determinista, trazable y sin llamadas adicionales a API**; la IA de outfits es un refinador posterior opcional, no fuente de verdad.

## 3. Ficha de prendas: esquema propuesto (campos opcionales)
Mantener compatibilidad con los campos existentes. **No se implementa la migración aquí.**
| Campo | Tipo/valores sugeridos | Por qué |
|---|---|---|
| category, type | Taxonomía actual: Arriba, Abajo, Vestidos, Capas, Zapatos, Bolsos, Accesorios, Casa, Baño | Roles estructurales. |
| color_primary, color_secondary[] | Hex/sRGB + nombre; porcentaje visual por zona opcional | Armonía del conjunto, estampados, acentos. |
| perceptual_color | OKLCH derivado en cliente, no almacenado necesariamente | Hue, luminosidad y cromaticidad; evitar solo «familias». |
| pattern | plain, stripes, checks, floral, animal, dots, graphic, other | Tipo de estampado. |
| pattern_scale, pattern_contrast | small/medium/large/unknown; low/medium/high/unknown | Mezcla de estampados. |
| fit / silhouette | fitted, straight, relaxed, oversized, flowing, unknown | Proporciones. |
| volume | slim, medium, voluminous, unknown | Equilibrio de masas. |
| length / waist | cropped, regular, midi, long, unknown; high/mid/low/unknown | Relación de largos, tiro. |
| texture_finish | matte, shiny, textured, sheer, unknown | Nivel de atención visual. |
| fabric_weight | light, medium, heavy, unknown | Clima y capas. |
| formality | casual, smartcasual, formal, party, sport, unknown | Contexto. |
| style_tags[] | IDs de perfiles estéticos, 0..N | Permite mezclas. |
| seasons, occasions[] | Tags existentes, múltiples | Filtro contextual, nunca tags rígidos por defecto. |
| statement_level | 0..3 | Protagonismo visual; heurístico. |
| confidence / manual_override | por atributo | Nunca reemplazar corrección humana por IA. |

**Regla ante desconocidos:** no penalizar fuertemente un campo no conocido ni inventarlo; bajar confianza de la recomendación y evitar explicaciones que lo mencionen. Una foto plana no demuestra cómo ajusta una prenda puesta.

## 4. Reglas cromáticas implementables
**Principios [A/E] y decisiones [I]:**
- Convertir RGB->OKLCH; analizar distancia de matiz solo cuando croma sea significativa. Blancos, grises y negros no tienen matiz fiable. [I]
- Identificar dominante, secundarios y acento por proporción visible; accesorios pesan menos que una falda o abrigo por área aproximada. [I]
- Calcular candidatos: monocromático/tonal, análogo, complementario, complementario dividido, triádico y base neutra+acento. Adobe describe esas familias, no su superioridad. [A]
- Armonía no implica siempre *poco contraste*: los perfiles «creativo» y «maximalista» pueden preferir oposición cromática intencionada. [I]
- No aceptar «todos los neutros combinan con todo» como verdad universal; comparar también luminosidad, textura y ocasión. [I]
- Un estampado es una paleta, no un color binario. Comparar sus colores dominantes con prendas lisas o con otros estampados; si hay dos estampados, analizar escala, densidad, contraste y vínculos cromáticos antes de penalizar. [E]
- **No** codificar «azul+rosa = sí / rojo+verde = no». Las parejas fijas son demasiado pobres y dependientes del tono. [I]
- Evitar imponer máximos de 3 colores como restricción dura. Puede ser una sugerencia suave para estilos minimalistas; no para maximalismo. [I]

## 5. Proporciones, estilo y contexto
- Comprobar **estructura**: (Arriba+Abajo) o (Vestido/Mono), y complementos Capas/Calzado/Bolsos/Accesorios según ocasión. No duplicar funciones incompatibles sin motivo. [I]
- **Equilibrio**: considerar fitted+voluminous, voluminous+straight, cropped+high-waist, capas largas/cortas y distribución de atención; no tratarlos como prohibiciones. [A/I]
- **Énfasis**: una prenda brillante/estampada puede ser protagonista, con apoyos discretos en minimalismo, o varios focos intencionados en maximalismo. [A/I]
- **Ritmo**: repetir de modo sutil tonos, líneas o texturas en distintas piezas puede crear coherencia. [A/I]
- **Coherencia de formalidad**: athletic+tailoring puede ser intencional en smart casual, streetwear y athleisure; penalizar solo mezclas inexplicables o fuera de contexto. [I]
- **Clima/función**: priorizar practicidad, lluvia, actividad, temperatura y capas razonables; no deducir impermeabilidad o abrigo exclusivamente de la apariencia. [I]
- **Accesorios**: completan, no rescatan, un núcleo incoherente. Un look sin bolso puede ser perfectamente válido. [I]
- **Contexto social**: evitar suponer códigos de vestimenta universales; permitir reglas personalizadas por trabajo/evento y perfil. [I]

## 6. Biblioteca de estilos: perfiles configurables, no categorías excluyentes
| Perfil | Estrategia base sugerida [I] | Excepción creativa |
|---|---|---|
| Minimalista | Tonales/neutros, 1 foco como máximo | Un contraste fuerte intencionado. |
| Clásico | Sastrería, equilibrio formal, colores sobrios | Mezclar con deportivas. |
| Elegante / formal | Silueta pulida, acabados y accesorios consistentes | Glam contrastado. |
| Casual | Denim, punto, algodón, calzado práctico | Elemento arreglado. |
| Smart casual | Unir casual y sastrería controlando formalidad | Deporte integrado. |
| Urbano / streetwear | Volumen, capas, gráficos, sneakers | Traje con zapatillas. |
| Athleisure / deportivo | Prendas técnicas o inspiración deportiva | Blazer con joggers. |
| Romántico | Texturas suaves, movimiento, motivos delicados | Botas contundentes. |
| Boho | Capas, texturas, motivos orgánicos | Accesorio contemporáneo. |
| Preppy | Camisas, punto, mocasines, referencias colegiales | Piezas urbanas. |
| Rock / grunge | Cuero, denim, contrastes, botas | Vestido delicado con botas. |
| Retro / vintage | Referencias de década coherentes | Mezcla vintage+actual. |
| Glam / fiesta | Brillo, satén, elementos statement | Street-glam equilibrado. |
| Maximalista | Mix de estampados, cromas, texturas | Contraste deliberado múltiple. |
| Creativo / vanguardista | Asimetría y proporción experimental | Mezclas inusuales intencionales. |

El estilo **es una preferencia explícita o una hipótesis editable**; no se atribuye automáticamente a la persona. Ninguno debe excluir al resto.

## 7. Motor: filtros, puntuación y diversidad
### 7.1 Candidatos
1. Leer contexto (ocasión, clima, estilo objetivo, prenda obligatoria, restricciones).
2. Filtrar prendas no disponibles, prohibidas o inadecuadas por requisitos **duros** de función/ocasión. «No sé» se trata distinto de «incompatible».
3. Construir núcleos Arriba+Abajo o Vestidos; complementar con Capas, Zapatos y accesorios si existen.
4. **Puntuación a nivel de outfit completo**, no suma simple de pares; contrastar cada prenda con el conjunto. [R: S5, S6]
5. Optimizar variedad mediante penalización por similitud con propuestas ya seleccionadas, no maximizar solo el primer score. [I]

### 7.2 Puntuación prototipo [I], ajustable
score = 0.25·COLOR + 0.25·SILUETA + 0.20·ESTILO + 0.20·CONTEXTO + 0.10·PERSONALIZACIÓN.
Cada componente normalizado 0..1; total 0..100. **Estos números no proceden de una fuente académica y NO son valores validados.** Reestimar con pruebas y sensibilidad por estilo. Restricciones duras se aplican ANTES y no pueden compensarse con puntos.
- COLOR: análisis de paleta completa, relación de cromas/claridad, estampados, acentos.
- SILUETA: proporciones, volumen, largos, relación entre capas.
- ESTILO: coherencia respecto del perfil estético solicitado; admitir mezclas intencionales.
- CONTEXTO: ocasión, formalidad, clima, actividad, preferencias expresas.
- PERSONALIZACIÓN: gustos, uso previo, repetición y feedback del perfil.
- confidence: separado del score, indica cuánto sabemos; no confundir seguridad del modelo con calidad del look.

### 7.3 Diversidad [I]
Seleccionar 3–5 propuestas mediante reranking: valor = score - λ·similitud(conjuntos ya seleccionados). Medir solapamiento de prendas y similitud estética. Exigir cuando sea posible al menos dos bases distintas; si el armario es pequeño, decirlo sin inventar alternativas.
Dos objetivos: «seguro/equilibrado» y «creativo/atrevido». Mostrar razón breve basada en datos conocidos: `matched_color`, `balanced_volume`, `repeated_accent`, `suitable_context`. No generar justificaciones no sustentadas.

## 8. Reglas en formato auditable — ejemplos
| ID | Condición | Acción | Excepciones | Base |
|---|---|---|---|---|
| C01 | Dominante y secundario con croma significativa | Evaluar armonía tonal, análoga, contraste | No obligar a elegir una sola armonía | S2, [I] |
| C02 | ≥2 estampados | Evaluar vínculos de paleta, escala y contraste | Permitir maximalista con más peso creativo | S3, [E/I] |
| P01 | Parte superior y abajo de volúmenes contrastados | Bonificar balance si encaja con estilo | Oversize integral es válido | S1, [A/I] |
| P02 | Una prenda statement | Explorar piezas de apoyo y réplica de acento | Perfil glam/maximalista | S1, [A/I] |
| F01 | Dress code explícito incumplido | Rechazar candidato | Solo si dress code declarado | [I] |
| F02 | Función requiere calzado y el conjunto carece de él | Avisar o completar si existe | Conjuntos parciales intencionales | [I] |
| L01 | Campo silhouette desconocido | No afirmar que «equilibra figura» | Se puede explicar el color | [I] |
| D01 | Dos looks propuestos muy similares | Reordenar por diversidad | Armario insuficiente: explicar | [I] |

### 8.1 Reglas candidatas (de la antigua #26)
Todas son **puntuación**, no restricciones, salvo que se diga. Pesos y umbrales [I], a calibrar.

| ID | Condición | Acción | Excepciones | Base |
|---|---|---|---|---|
| C03 | Dos piezas de la misma familia de matiz con claridad distinta (tono sobre tono) | Bonificar armonía | Ninguna conocida | S8 [A], S13 |
| C04 | Matices vecinos (≈ < 60° en OKLCH) con croma significativa | Bonificar armonía | — | S8 [A], S2 |
| C05 | Matices opuestos en dos piezas grandes | Penalizar armonía; bonificar si uno es acento pequeño (complemento, calzado) | Perfiles creativo/maximalista: penalización menor | S8 [A], S13 [E] |
| C06 | Contraste de claridad entre piezas principales | Bonificar | Minimalista tonal busca poco contraste | S8 [A] |
| C07 | Vaquero, marino, oliva, camel, gris, beige, negro, blanco | Tratar como casi neutros (croma baja o uso como base) | No convierte cualquier par en bueno: seguir mirando claridad y textura (§4) | S13 [E], S12 |
| C08 | Pieza lisa que repite un color dominante de un estampado | Bonificar (`matched_color`) | — | S9 [E] |
| C09 | Marino + negro con poca diferencia de claridad | Penalizar | Con contraste visible: neutro | S10 [E] |
| C10 | Negro + marrón, marino + negro | No penalizar por sí mismos | — | S14 [E] |
| C11 | Pieza metalizada | Tratarla como protagonista (statement); bonificar apoyos neutros; mezcla de metales solo en detalles | Glam/maximalista | S12 [E] |
| C12 | Dos cromas altas lejanas sin pieza neutra que las una | Penalizar | Maximalista/creativo | S8 [A], S9 [E] |
| C13 | Más de 3 colores no neutros | Penalizar suavemente | Maximalista (ya en §4) | S10 [E], [I] |
| E01 | Dos estampados que comparten color o tienen escalas distintas | Bonificar; si no, penalizar | Maximalista: penalización menor | S9 [E], S3 |
| E02 | Estampado pequeño de bajo contraste (rayas finas, lunares, cuadro pequeño) | Tratar casi como liso | — | S9 [E] |
| E03 | Dos estampados + pieza lisa neutra (americana, vaquero, calzado) | Bonificar (ancla) | — | S9 [E] |
| E04 | Tres o más estampados | Penalizar fuerte | Maximalista | S9 [E], [I] |
| P03 | Arriba que termina en la cintura o metida + abajo largo (≈ 1/3–2/3) | Bonificar | Oversize integral (P01) | S11 [E], S1 |
| P04 | Capa larga sobre base más corta | Bonificar línea vertical | — | S11 [E] |
| P05 | Cinturón en vestido o prenda amplia | Bonificar | Solo si el cinturón existe en el armario | S11 [E] |
| F03 | Una sola pieza de otro nivel de formalidad (americana con vaqueros, deportivas con falda) | Bonificar como mezcla intencionada | Dress code declarado (F01) | §5 [I] |
| F04 | Calzado | Pesa más en la formalidad final del look | — | [I] |

### 8.2 Regresiones conocidas del motor actual (`pairs` / `colorsMatch` en `atelier/atelier.js`)
Incluirlas como casos del banco de pruebas (§10):
- Dos estampados cualesquiera se descartan siempre (contradice C02, E01–E03).
- `GOOD_PAIRS` da como siempre buenos complementarios como azul–naranja (contradice C05 / S8).
- Solo se usa el color principal y por palabras: se ignoran secundarios y claridad (C06, C08).
- Todo es sí/no: no ordena por calidad ni explica (§7).
- Sin proporciones (P01, P03–P05).

## 9. Interfaces propuestas (no implementadas)
- `GET /stylist/rules?v=1` opcional: manifest versionado local; no hace falta backend al principio.
- `rankOutfits(garments, context, profile, rulesVersion) => [{ids, score, confidence, reasons:[{ruleId,evidence}], warnings}]`.
- `context={occasion, temperature?, precipitation?, activity?, styleProfiles[], creativityLevel, requiredGarmentId?, excludedGarmentIds[]}`.
- `profile={likedLookIds, dislikedLookIds, recentWear, blockedGarments, stylePreferences}`.
- Reglas versionadas con ID estable, severity, evidence; logs **sin almacenar fotos** para diagnóstico.
- Integrar en las vistas Hoy / Combinar prenda / Maletas; la IA generativa NO debe poder sugerir IDs ajenos al inventario.

## 10. Plan de evaluación / criterios de aceptación
1. Crear banco anonimizado de **al menos 150 conjuntos** repartidos entre 15 familias de estilo: ejemplos plausibles, problemáticos, mixtos y deliberadamente atrevidos. **Meta del plan, no conjunto ya creado.**
2. Para cada caso registrar: contexto, prendas, atributos conocidos/desconocidos, 2+ juicios humanos (idealmente 1 estilista), razón y discrepancias. Contemplar diversidad cultural y de preferencias.
3. Tests invariantes automáticos: solo IDs existentes, no ropa interior, no prendas duplicadas, restricción obligatoria respetada, no explicar atributos desconocidos, no cambios en el armario.
4. Metodología: comparación ciega A/B motor actual vs nuevo, aprobación top-3, utilidad contextual, diversidad, razones correctas, tasa de contradicción y latencia móvil. **No fijar aprobación ≥X % sin baseline.**
5. Separar test de calibración y test independiente; no afinar pesos con el test final. Revisar casos de fallo (tonos cercanos, tejidos brillantes, capas largas, dos estampados).
6. Validación inclusiva: no «corregir» proporciones corporales no inferibles ni clasificar cuerpos; las preferencias de usuaria mandan.
7. Lanzamiento gradual: feature flag y vuelta al motor anterior, sin romper looks guardados.

## 11. Plan por PR
- **PR A (esta):** manual, fuentes y criterios. Solo documentación; sin API, sin imágenes, sin gasto.
- **PR B:** atributos extra y edición/correcciones manuales en ficha, sin modificar fotos ni ocultar atributos desconocidos.
- **PR C:** motor local determinista + tests de invariantes y razones auditables; mantener motor anterior detrás de flag.
- **PR D:** dataset de evaluación y primera calibración humana; instrumentos de feedback por perfil.
- **PR E:** diversidad, explicación y personalización mejoradas; opcional experimentación con modelos visuales tras verificar licencias y coste.

## 12. Decisiones aún abiertas
- ¿Qué códigos de vestir usan los perfiles (trabajo, celebraciones, deporte)?
- ¿En qué medida priorizar variedad vs seguridad visual?
- ¿Se desea una opción «sorpréndeme» distinta de las sugerencias habituales?
- ¿Qué prendas deberían estar disponibles / lavando / prestadas?
- ¿Quién revisará muestras: perfiles familiares y/o estilista profesional?

**No fusionar código del motor hasta tener un primer benchmark**; esta especificación debe evolucionar con resultados reales.
