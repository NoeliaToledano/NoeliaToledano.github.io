# Atelier — Fundamentos del estilismo y propuesta de motor (investigación, 2026-10-09)

> Documento de investigación, **no cambios implementados**. Trabajo paralelo a los pares A/B de Claude (#131, #128). No entrenar con las etiquetas del conjunto de evaluación y después anunciar resultados sobre ese mismo conjunto.

## 1. Qué hace realmente una estilista

Una estilista evalúa la intención (qué quiere comunicar la persona), las restricciones (ocasión, clima, movilidad, comodidad, normas del entorno), la composición visual (color, proporción, textura, estructura, foco) y la identidad personal. **La compatibilidad no es mera similitud** y la estética no es objetiva ni estática. Evitar normas universales que penalicen expresiones culturales, cuerpos, estilos personales o combinaciones maximalistas.

Orden de decisiones:
1. Comprender intención + contexto + preferencias explícitas.
2. Seleccionar plantilla de categorías (vestido+zapatos, top+bottom+zapatos, conjuntos con capas, etc.) y filtrar restricciones imposibles.
3. Generar candidatos variados que empleen **prendas reales disponibles**.
4. Puntuar compatibilidad contextual del conjunto; no sumar solamente afinidades entre parejas.
5. Reranking personalizado + diversidad de los primeros resultados; explicar solo motivos sustentados por metadatos.
6. Registrar feedback y aprender paulatinamente sin castigar exploración.

## 2. Gramática de estilismo — atributos de las prendas

| Dimensión | Campos sugeridos | Riesgo |
| --- | --- | --- |
| Color | paleta visible, proporción de área, matiz, claridad, croma, temperatura aparente, neutros | el color dominante de foto no basta en estampados |
| Corte y volumen | fit, estructura, tiro, largo, ancho, línea de cintura, caída | oversize no es error intrínseco |
| Tejido y superficie | denim, lino, punto, satén, cuero; rugosidad, brillo, fluidez, transparencia | inferencias de foto pueden ser inciertas |
| Patrón | tipo, tamaño relativo, densidad, contraste, paleta y área visible | dos estampados no implican incompatibilidad |
| Formalidad | espectro y excepciones por ocasión, calzado, desgaste | informal/fiesta/trabajo dependen del contexto |
| Función | térmico, impermeabilidad, caminabilidad, soporte, actividad | no inferir seguridad/calidez exacta de la foto |
| Semántica | estilo, pieza protagonista, temporada cultural, versatilidad | tendencias pasajeras ≠ reglas universales |
| Confianza | conocido, inferido, desconocido, corregido por usuario | incertidumbre no debe convertirse en penalización |

**Datos faltantes:** nunca asumir que "desconocido" significa malo. Usar estimación neutral, margen de confianza, o solicitar corrección solo si decisivo.

## 3. Color: de la teoría a decisiones sobre prendas

Fundamentos: matiz (hue), claridad/valor (lightness), croma/saturación, temperatura percibida, contraste simultáneo y áreas visibles. Josef Albers mostró que el color percibido depende de los colores que lo rodean. No usar simplemente una distancia RGB entre dos colores.

Relaciones útiles: neutros + acento; monocromía con diferencia de claridad/textura; análogos; complementarios; tríadas; armonía deliberadamente contrastada. Tratar esas relaciones como **hipótesis estilísticas contextualizadas**, no como mandamientos. Un total look negro con texturas distintas puede ser excelente; un look de colores complementarios puede fallar por distribución o proporciones.

Para estampados: evaluar si comparten uno o varios colores, tamaño/densidad del motivo, contraste interno, superficie cubierta, separación mediante básicos y protagonismo visual. No imponer "un único estampado".

**Pruebas difíciles:** azul marino+negro; azul+verde; negro+marrón; crema+blanco; rojo+rosa; dos estampados con paleta común; triple estampado deliberadamente maximalista; conjunto monocromo con diferentes texturas; color fuerte repetido en accesorio pequeño. Etiquetar con votantes humanos y estilo pretendido.

## 4. Silueta, proporción y estructura

Equilibrio NO significa obligar siempre a una prenda ajustada y otra holgada. Evaluar por intención:
- Cómoda: holgado+holgado puede ser deseable; importa largo, caída, estructura y proporción.
- Trabajo: una silueta relajada con blazer y calzado apropiado puede ser válida.
- Elegante: fluidez y volúmenes amplios pueden resultar sofisticados.
- Urbano/maximalista: el contraste intencional puede ser un mérito.

Variables importantes: volumen parte superior/inferior, longitud visible, punto de cintura, altura de tiro, estructura de hombros, capas, contraste entre piezas, peso visual del calzado. NO hacer recomendaciones normativas sobre cuerpos ni inferir medidas de la usuaria.

Errores potenciales: normalizar `fit` solamente a 0/1/2 puede perder distinciones entre oversize, corte recto y una prenda ajustada, así como la influencia del largo y estructura. Usar puntuación suave y contexto, con casos adversariales.

## 5. Tejidos, acabados, calzado y accesorios

Compatibilidad de textura: tejidos mates y brillantes; fluidez vs estructura; densidad/capas; delicado vs grueso; continuidad de acabados metálicos. No exigir que todas las texturas coincidan. Un zapato puede recontextualizar todo el look: deportivas limpias con sastrería, tacones con jeans, botas con vestido; graduar por ocasión/estilo, no prohibir la categoría indiscriminadamente.

Evaluar complementos por **función y protagonismo**: bolso de día frente a fiesta, mochila técnica frente a estética urbana, bufanda funcional, joyería discreta vs statement. Contar accesorios no garantiza un look completo; exceso de accesorios tampoco es objetivamente un error.

## 6. Ocasión, tiempo y uso real

Ocasion incluye lugar, cultura de vestimenta, actividad, duración, movilidad, espacio interior/exterior y código explícito. "Trabajo" no es universal: oficina informal, entrevista formal, entorno creativo y uniforme no deberían compartir exactamente las mismas restricciones.

Para clima, aprovechar ISO 9920 y ASHRAE como fundamentos de aislamiento de conjuntos, pero **clo no predice por sí solo la comodidad exterior** (actividad, viento, humedad, lluvia, sensación térmica y capas importan). La norma ISO 9920 estima aislamiento/resistencia, no lluvia/nieve ni disconfort asimétrico. Conservar advertencias como probabilísticas, no certezas.

## 7. Algoritmos publicados reutilizables como inspiración

- **Type-aware compatibility:** Vasileva et al., ECCV 2018 (similitud de misma categoría vs compatibilidad entre categorías; Polyvore). https://openaccess.thecvf.com/content_ECCV_2018/html/Mariya_Vasileva_Learning_Type-Aware_Embeddings_ECCV_2018_paper.html ; código: https://github.com/mvasil/fashion-compatibility
- **Compatibilidad contextual:** Cucurull et al., CVPR 2019, usa contexto visual de otras prendas y embeddings dependientes de contexto. https://openaccess.thecvf.com/content_CVPR_2019/html/Cucurull_Context-Aware_Visual_Compatibility_Prediction_CVPR_2019_paper.html
- **Plantillas + personalización:** Ding et al., Information Processing & Management 2023 (Template-guided Outfit Generation: preferencias por categorías, por prendas y compatibilidad). https://research.polyu.edu.hk/en/publications/personalized-fashion-outfit-generation-with-user-coordination-pre/
- **Preferencias con pocos datos:** Verma et al., 2020, cold start basado en preferencias visuales. https://arxiv.org/abs/2008.01437
- **Estabilidad de preferencias:** estudio de 2025 con feedback implícito y multimodalidad. https://www.sciencedirect.com/science/article/pii/S0167923625000569
- **Tendencia 2026 (investigación, no adoptada):** CA² combina atributos finos dependientes de contexto y consistencia global. https://www.sciencedirect.com/science/article/pii/S0306457326005431
- **Principios visuales:** equilibrio, proporción, foco, ritmo y armonía. https://www.voguefashioninstitute.com/key-principles-of-fashion-design-every-student-must-learn/ ; referencia de percepción cromática: https://yalebooks.yale.edu/book/9780300179354/interaction-of-color/
- **Estampados complejos:** ejemplos profesionales de mezclas exitosas: https://www.vogue.com/article/street-style-clashing-prints-patterns ; https://www.teenvogue.com/story/how-to-mix-prints-without-clashing-according-to-fashion-experts
- **Aislamiento:** ISO 9920 https://www.iso.org/standard/39257.html ; ASHRAE https://handbook.ashrae.org/Handbooks/F21/SI/F21_Ch09/F21_Ch09_si.aspx

**Cautela:** verificar licencias de código, pesos, fotografías y datasets; Polyvore no implica derecho a redistribuir imágenes. Trabajos de investigación no son servicios listos para producción. No introducir modelo multimodal pesado hasta superar baseline y medir coste.

## 8. Arquitectura propuesta, a contrastar antes de codificar

```text
intent + personal preferences + context
             ↓
category templates / candidate generation
             ↓
hard constraints (real prohibitions, outfit complete, unavailable garments)
             ↓
contextual styling compatibility score (color + silhouette + fabric + occasion + whole-outfit intent)
             ↓
personal preference adjustment (likes/dislikes, saves, worn, explicit rules)
             ↓
diversity / exploration reranker (avoid duplicates; not repeat same template)
             ↓
top looks with evidence-based reasons and uncertainty
```

Recomendaría empezar con **rasgos interpretables existentes** (no pagos por recomendación). Después probar embeddings visuales precalculados por prenda, comparando su valor añadido. Separar reglas duras (seguridad/ocasión estricta) de reglas blandas de estilo. Evitar doble conteo de la misma señal (p. ej. `fit` en silueta y coherencia) y conflictos entre penalizaciones.

No fijar pesos definitivos todavía. Aprender/calibrar con conjunto de desarrollo, congelar test A/B independiente, y comprobar por persona, ocasión, tamaño de armario y estilo.

## 9. Protocolo de evaluación junto al juego A/B de Claude (#128)

- Usar pares ciegos, orden A/B aleatorizado, imágenes y escenarios iguales, **varios jueces humanos** cuando se pueda, con categoría de "empate" y "no hay suficiente información".
- Separar **fácil** (incumplimiento evidente de ocasión/temperatura) de **difícil** (ambos conjuntos válidos y decisión estética). Reportar precisión de preferencias por separado.
- NO ajustar las reglas mirando las respuestas del test final; crear desarrollo y test separados por prendas/outfits para reducir fuga.
- Revisar desacuerdos entre jueces: un estilo maximalista o cómodo puede ser una elección válida, no una anomalía.
- Mantener reportes del comparador #135 con incidencias, cambios reales, diversidad y regresiones; no interpretar una bajada de "warnings" como mejora estética confirmada.
- Medir top-1/top-3, tasa de abstención, explicación fiel, diversidad, latencia y coste.
- No incorporar datos sensibles de aspecto/cuerpo ni preferencias inferidas sin confirmación.

## 10. Plan de incorporación (sin interferir con Claude)

**Fase A — ya:** documentar conocimiento, convertirlo en taxonomía y rubric de comparación; Claude mantiene pares A/B; ChatGPT audita señal, sesgos y ranking.
**Fase B — experimento:** baseline del motor actual vs puntuación contextual ligera basada en atributos; sin cambios de producción; registrar casos ganados/perdidos.
**Fase C — opcional:** si la mejora no basta, probar embeddings visuales precalculados; revisar licencia, privacidad y rendimiento.
**Fase D — despliegue:** PR pequeña, checks verdes y banco de regresión; explicación comprensible de por qué el look encaja.

**Decisión de producto:** nunca vender como "estilista experto" un modelo que solo supera sus propias reglas; exigir evaluación externa con personas y preferencias reales.
