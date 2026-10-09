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


## 11. Segunda ronda de investigación: detectar la pieza que falla y recuperar alternativas

**Problema central:** las puntuaciones de compatibilidad describen el look, pero pueden no indicar qué cambio lo mejoraría. La tarea de *visual incompatibility detection* (VICTOR, 2023) estudia detectar el elemento discordante de un outfit y entrenar representaciones contrastivas de prendas. Distinguir: (a) puntuar look completo, (b) detectar pieza discordante y (c) sustituirla por una alternativa disponible. Fuente: https://www.sciencedirect.com/science/article/pii/S1047320322002619

**Experimento Atelier**: para cada conjunto del banco con error concreto, generar sustituciones de **una sola prenda** y comparar el cambio de puntuación con un juicio humano. Métricas:
- localizar la pieza problemática correcta (top-1/top-2);
- mejorar el look sin romper ocasión/clima/completitud;
- minimizar reemplazos innecesarios;
- explicaciones coherentes: “este calzado hace más informal el conjunto” solo si los atributos lo respaldan.

Importante: la pieza diferente o llamativa no es necesariamente la discordante. El estilismo maximalista debe poder tener un punto focal intencionado.

## 12. Grafos e interacciones de orden superior

**Dressing as a Whole** (Cui et al., 2019) representa categorías como nodos y aprende interacciones entre categorías, evitando tratar todo outfit como una lista ordenada. https://arxiv.org/abs/1902.08009

**OCPHN** (2022) modela compatibilidad mediante hipergrafos: la relación entre tres o más prendas puede ser diferente a la suma de relaciones por pares. https://www.mdpi.com/2227-7390/10/20/3913

**Comparación GNN 2024** (Gulati) reproduce enfoques de grafos e hipergrafos sobre Polyvore e investiga embeddings visuales. No asumir que sus números trasladan directamente a armarios privados pequeños. https://arxiv.org/abs/2404.18040

**Implementación ligera propuesta antes de aprender GNN**:
1. Extraer un vector legible de cada prenda: categoría, matiz/croma/claridad, fit, longitud, textura, formalidad, patrón, capacidad térmica, grado de confianza.
2. Extraer funciones agregadas del outfit: balance de color por superficie aproximada, número de focos, contraste de volumen, continuidad de formalidad, mezcla de tejidos, capas, coherencia climática.
3. Añadir interacciones explícitas **solo si el banco A/B muestra valor incremental**: por ejemplo (vestido de fiesta, deportivas, ocasión formal) y (estampado superior, estampado bolso, tercera prenda neutra).
4. Comparar el baseline agregador con un ranker ligero entrenado en un conjunto de desarrollo y con una evaluación ciega separada.
5. Considerar grafo/hipergrafo o embeddings solo cuando haya suficiente dato etiquetado, soporte de licencias y beneficio frente a un método explicable.

## 13. Evidencia nueva de multimodalidad y preferencias

- **LMLMO (Decision Support Systems, 2025)** usa características visuales e inferencias multimodales para valorar combinaciones; estudia FashionVC y EVALUATION3. https://www.sciencedirect.com/science/article/pii/S0167923625000582
- **GPA-BPR (Decision Support Systems, 2025)** estudia la estabilidad de gustos con interacciones usuario-prenda y feedback implícito. https://www.sciencedirect.com/science/article/pii/S0167923625000569
- **Personalized Outfit Compatibility Prediction Using Outfit Graph Network (IJCNN, 2023)** combina la representación del conjunto con una representación de preferencia individual. https://ieeexplore.ieee.org/document/10191458/
- **Review of Explainable Fashion Compatibility Modeling Methods (ACM Computing Surveys, 2024)** es una revisión útil sobre reproducibilidad, explicabilidad, sesgos y sostenibilidad. DOI 10.1145/3664614. https://doi.org/10.1145/3664614

**Aplicación práctica:** Atelier ya captura favoritos/rechazos. Separar aprendizaje de (i) afinidad estética general, (ii) preferencias persistentes del perfil, (iii) intención de la sesión. No interpretar un rechazo aislado como una prohibición global. No compartir preferencias entre perfiles familiares.

## 14. Qué enseñan las guías de estilismo sobre creatividad

University of the Arts London recomienda fundamentos de forma, color y proporción, uso intencionado de accesorios y experimentación con contrastes de materiales, siluetas y tonos. La creatividad es compatible con un motor medible si las convenciones son preferencias blandas contextualizadas. https://www.arts.ac.uk/study-at-ual/short-courses/stories/3-golden-rules-for-aspiring-fashion-stylists

Un ranker no debe premiar siempre “mínimo número de estampados”, “todo neutro”, “parte ajustada + parte holgada”, “tacones con vestidos” ni “colores cercanos”. Debe poder reconocer un *look armonioso clásico* y un *look expresivo intencional* como dos objetivos distintos.

## 15. Precaución fundamental: fuga de información en benchmarks

Proyecto independiente Runway publica una experiencia instructiva: sus primeras métricas eran artificialmente altas cuando el grafo utilizado para evaluar incluía señal de coaparición del conjunto de prueba; al pasar a una evaluación inductiva sin esos enlaces, reporta AUC inferior. Es una advertencia metodológica, no un benchmark verificado de Atelier. https://github.com/NeilP211/runway

Diseñar tests disjoint por prenda, outfit y, cuando sea posible, fuente/usuario; evitar reutilizar los mismos pares A/B para inventar la regla y certificar el resultado. Reportar métricas separadas de casos fáciles (cumplimiento de reglas) y casos difíciles (decisión estética).

## 16. Nuevas pruebas adversariales prioritarias

| Prueba | Diferencia que el motor debe aprender |
| --- | --- |
| Blazer + pantalón sastre + calzado | zapatillas limpias en oficina creativa vs sneakers técnicas en entrevista formal |
| Vestido + botas | botín estructurado elegante vs botas de nieve en evento interior |
| Rayas + cuadros | escala/paleta compatibles vs estampados que compiten |
| Oversize + oversize | silueta relajada deliberada vs capas desproporcionadas para el objetivo elegido |
| Total black | textura, brillo, estructura y focalización vs ausencia de contraste visual |
| Dos denim | lavado/tono armonizados o contraste intencionado vs piezas sin intención |
| Falda satinada + punto | mezcla atractiva de texturas vs una desproporción poco funcional |
| Abrigo + bufanda | aislamiento suficiente vs accesorio insuficiente como sustituto del abrigo |
| Prenda protagonista | otras prendas enmarcan el foco vs varios focos compiten sin intención |
| Look válido rechazado | separar “no es mi estilo” de “no funciona estéticamente” |
| Vestido sin tacones | no penalizar sistemáticamente bailarinas, botas o deportivas si el contexto las admite |
| Color complementario | controlar saturación y superficie vs aprobar por teoría del círculo cromático |

**Entregables antes de cambiar el motor:** matriz de errores por ocasión/estilo, etiqueta de confianza por atributo, mecanismo de explicación y búsqueda de sustitución, test ciego congelado y baseline contra los datos actuales. Ninguna métrica aislada certifica criterio humano.
