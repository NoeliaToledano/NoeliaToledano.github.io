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


## 17. Tercera ronda contrastada: explicaciones verificables y compatibilidad por atributos

**Hallazgo de investigación 2024:** *Deciphering Compatibility Relationships with Textual Descriptions via Extraction and Explanation* (AAAI 2024) publicó Pair Fashion Explanation (PFE), un recurso centrado en explicar relaciones de compatibilidad entre prendas, y un procedimiento en dos etapas para generar explicaciones más informativas. Artículo: https://ojs.aaai.org/index.php/AAAI/article/view/28764 ; código/datos: https://github.com/wangyu-ustc/PairFashionExplanation .

**Hallazgo de investigación 2024:** *Explainable Fashion Compatibility Prediction: An Attribute-Augmented Neural Framework* (Electronic Commerce Research and Applications, 2024) propone modelar interacciones **a nivel de atributos** utilizando imagen más metadatos, no una sola representación global de prenda. https://www.sciencedirect.com/science/article/abs/pii/S1567422324000966

**Implicación para Atelier:** diseñar un evaluador de compatibilidad que devuelva señales estructuradas comprobables, no solo un score opaco:

```json
{
  "compatibility": 0.0,
  "confidence": 0.0,
  "evidence": [
    {"kind":"color_balance","garmentIds":["a","b"],"effect":"positive","confidence":0.8},
    {"kind":"occasion_formality","garmentIds":["c"],"effect":"negative","confidence":0.9}
  ],
  "proposedSwap": {"removeId":"c","replaceId":"d","expectedBenefit":"occasion_fit"}
}
```

Solo un **contrato hipotético para experimentación**: no introducir scores ni porcentajes de confianza inventados en la interfaz. Para mostrar “estilísticamente favorecedor”, la señal deberá estar apoyada en atributos reales; una explicación plausible pero falsa perjudica la confianza. No generar explicaciones con un modelo costoso si la razón ya sale del motor local.

## 18. El problema de la evaluación y el riesgo de sobreajuste

Revisión académica: Selwon y Szymański, *A Review of Explainable Fashion Compatibility Modeling Methods*, ACM Computing Surveys 2024, examina reproducibilidad, interpretabilidad, sesgos en datasets y sostenibilidad de sistemas de recomendación de moda. https://doi.org/10.1145/3664614

Otra revisión extensa, *Computational Technologies for Fashion Recommendation: A Survey*, ACM Computing Surveys 2024, separa las tareas de recomendación de prendas, compatibilidad, conjuntos completos y personalización, y subraya diferencias entre estudios y necesidades reales. https://doi.org/10.1145/3627100

**Crítico:** Polyvore nondisjoint permite reutilizar prendas entre train/test; Polyvore disjoint separa prendas, por lo que es más exigente para generalizar a un armario que no aparecía en entrenamiento. Referencia de implementación con descripción de las particiones: https://github.com/open-mmlab/mmfashion/blob/master/docs/dataset/FASHION_COMPATIBILITY_DATASET.md ; ficha del dataset original: https://mariya.fyi/polyvore .

El repositorio Runway publica un ejemplo ilustrativo: reportó una AUC muy inflada al incluir conexiones del test en el grafo y la corrigió con embeddings inductivos sin contexto del test. Sus números son autodeclarados, no una evaluación independiente. https://github.com/NeilP211/runway

**Protocolo recomendado:** usar partición de desarrollo para calibración y congelar otra de test; evitar fugas por foto, prenda, outfit, usuario, variantes de prendas duplicadas o misma fuente fotográfica; reportar intervalos de incertidumbre (bootstrap por outfit/armario, no por prendas dependientes). No decir “supera a una estilista” sin evaluación humana profesional y diseño de comparación apropiado.

## 19. De un solo juez a preferencias fiables

El banco A/B de Claude es un excelente **conjunto inicial de hipótesis**, no un patrón oro infalible. Un juez que crea ejemplos también puede construirlos de forma que favorezcan las reglas que ya conoce.

Recomendación para interfaz de evaluación humana:
1. Mostrar dos looks en orden aleatorio, misma ocasión, temperatura y perfil de estilo, sin puntuaciones ni textos explicativos que revelen la respuesta esperada.
2. Respuestas: prefiero A, prefiero B, ambos funcionan, ninguno funciona, información insuficiente.
3. Pedir motivo opcional normalizado: ocasión, proporciones, color, textura, estampado, calzado, comodidad, identidad personal.
4. Guardar votos agregados anónimos; separar acuerdo entre evaluadores y dificultad.
5. No convertir desacuerdos en errores automáticamente: pueden reflejar estilos diferentes o un contexto mal especificado.

**Métricas**: accuracy A/B en casos con acuerdo claro, tasa de empatados, acuerdo interevaluador, peor resultado por ocasión, diversidad de estilos, rendimiento en armarios pequeños, latencia, coste y calidad factual de las explicaciones.

## 20. Priorización técnica propuesta

- **P0: etiquetas y ejemplos de calidad**. Verificar que las causas de error de las pruebas sean correctas y no preferencias subjetivas disfrazadas de normas.
- **P1: trazabilidad de señales**. Conocer por qué un look sube o baja para localizar dobles penalizaciones y conflictos de contexto.
- **P2: reranking contextual**. Aplicar atributos a nivel de conjunto y condiciones del usuario, comparando contra el motor actual con tests cegados.
- **P3: sustitución óptima de una pieza**. Optimizar una sustitución local y explicar la razón con señales verificables.
- **P4: representación visual aprendida**. Solo si P0-P3 muestran límites cuantificados y la nueva opción supera un baseline simple a coste aceptable.

**Principio final:** primero enseñanza de buenas decisiones y medición de calidad humana; luego, si aporta valor, complejidad neuronal. La prioridad no es maximizar una puntuación interna sino mejorar la experiencia de vestir con prendas ya disponibles.


## 21. Cuarta ronda: principios de composición verificables (balance, proporción, énfasis y ritmo)

**Fuente institucional:** Utah State University Extension, *Design Principles for Clothing and Textiles*, explica que balance, proporción/escala, énfasis, ritmo y armonía se aplican al conjunto, no únicamente a prendas individuales. https://extension.usu.edu/research/principles-of-design . También Fashion Institute of Technology ofrece ejemplos de simetría/asimetría, énfasis y ritmo en diseño: https://www.fitnyc.edu/museum/documents/elements-and-principles-of-fashion-design.pdf .

**Traducción operativa, como hipótesis comprobables y NO reglas universales:**
- **Peso visual:** estimar por superficie visible, contraste con prendas vecinas, saturación, complejidad del estampado y detalle; un accesorio pequeño brillante puede atraer más atención que una chaqueta grande neutra. Sin segmentación real, usar confianza baja en superficie.
- **Punto focal:** detectar posibles protagonistas (color acento, prenda estampada, silueta singular, acabado metálico). Un outfit puede ser deliberadamente maximalista y tener varios focos: no penalizarlo sin contexto.
- **Ritmo:** repetición de color, motivo, textura, geometría o detalles (bolso que recupera el tono de un estampado, metal de pendientes y hebilla); repetición no significa obligación de igualar bolso y zapatos.
- **Proporción:** relación entre largos y volúmenes de piezas, sin implicar juicios sobre el cuerpo o “tipo de figura”. La posición real de la cintura y la caída no se conocen por una fotografía de la prenda aislada.
- **Equilibrio asimétrico:** los dos lados de un look pueden contrastar y, aun así, verse intencionales; evitar sesgo hacia simetría o combinaciones neutras.

**Tests:** look monocromo texturizado vs uniforme plano; foco rojo pequeño vs varios acentos que compiten; blazer estructurado+palazzo fluido vs dos prendas similares sin contraste; color repetido en bolso en proporción pequeña; punto focal de estampado más zapato neutro; maximalismo intencionado con múltiples estampados y paleta cohesiva.

## 22. Aprendizaje interactivo, desde cero y por sesión

**Referencia nueva:** *Interactive Garment Recommendation with User in the Loop* (ACM TOMM, 2024) investiga construir preferencias sobre la marcha a partir de reacciones del usuario sin historial previo. https://doi.org/10.1145/3702327 .

**Referencia complementaria:** *Leveraging meta-path and co-attention to model consumer preference stability in fashion recommendations* (Decision Support Systems, 2025) diferencia compatibilidad general de preferencias estables y explora señales implícitas. https://www.sciencedirect.com/science/article/pii/S0167923625000569 .

**Propuesta para Atelier:** representar tres escalas de gustos, con controles explícitos:
1. **Preferencia de esta sesión:** «hoy quiero algo colorido», «no quiero tacones», «voy a caminar mucho»; prioridad elevada pero temporal.
2. **Preferencia persistente del perfil:** guardar/salvar look, likes/dislikes repetidos, estilos habituales; actualización lenta, sin transformar un solo rechazo en prohibición.
3. **Exploración suave:** enseñar alguna alternativa diferente bien justificada; no encerrarse en una única fórmula por historial.

Guardar la **razón del rechazo**, cuando el usuario quiera darla, es más informativo que un dislike sin contexto. Ejemplo: «no me gusta este color», «no tengo ganas de llevar falda hoy», «demasiado formal», «no llevaría ese zapato». No inferir medidas corporales, salud, identidad u otros datos sensibles. Separar rigurosamente perfiles familiares.

## 23. Edición de outfits, compatibilidad por atributos y minimización de cambios

*PFNet: Attribute-aware personalized fashion editing with explainable fashion compatibility analysis* (Information Processing & Management, 2024) examina edición de atributos y explicaciones de compatibilidad. Su problema no es idéntico al de Atelier, que sustituye prendas reales, pero sugiere separar **qué atributo está fallando** de **qué pieza debemos cambiar**. https://www.sciencedirect.com/science/article/pii/S0306457323002777

**Experimento operativo:** dada una base de look seleccionada por la usuaria, identificar el atributo menos compatible con intención+ocasión y probar sustituciones de una prenda a la vez. Devolver **máximo tres** cambios de distinta naturaleza: una solución conservadora, una creativa y una cómoda, siempre desde el armario existente. Nunca reemplazar automáticamente la pieza que la usuaria ha marcado como favorita o protagonista sin pedirlo.

**Métrica:** preferencia humana por el look antes/después, respeto a la pieza ancla, número de sustituciones, diversidad de soluciones y tiempo de interacción; ninguna cifra de mejora sin votos o comparaciones reales.

## 24. Ejecución recomendada para el experimento

Añadir a los pares A/B una etiqueta opcional de **intención estética**: `minimalista`, `clásica`, `romántica`, `urbana`, `maximalista`, `relajada` o `sin especificar`. No adjudicar estética por género, edad ni cuerpo. Anotar **motivo** del juez por dimensión: `color`, `proporción`, `punto_focal`, `ritmo`, `textura`, `ocasión`, `comodidad`.

Crear dos particiones: desarrollo para experimentar y test reservado para decisiones finales. La calidad observada solo en desarrollo es hipótesis, no resultado. Primero comprobar si estas señales aportan información adicional sobre los atributos que ya puntúa `scoreOutfit`; si no aportan, no añadirlas. Evitar penalizar dos veces el mismo problema como "color" y "armonía global".

**Criterio de producto:** un buen asistente debe poder explicar y preservar intenciones deliberadas («quiero ir oversize», «quiero destacar», «quiero estrenar estas botas») incluso si contradicen la recomendación más convencional.


## 25. Quinta ronda: teoría convertida en señales útiles y coste de cada una

**Fuentes verificadas:** Utah State University Extension explica equilibrio, proporción, énfasis, ritmo y armonía, remarcando que la apreciación de armonía es subjetiva: https://extension.usu.edu/research/principles-of-design . La guía práctica de GetWardrobe organiza la composición en color, proporción/líneas y estilo/contexto: https://help.getwardrobe.com/latest/items/outfit-principles/ . Esto apoya *dimensiones de evaluación*, pero **no valida coeficientes ni reglas como la de tres colores o la de tercios**.

Propuesta: evaluar cada señal según **datos necesarios, confianza, coste y riesgo**:

| Señal | Mínimo de datos | Fuente/operación | Fiabilidad esperada | Riesgo |
|---|---|---|---|---|
| Formalidad por ocasión | ocasión + estilo y tipo de prenda | ficha del armario | media-alta si editada por usuaria | excepciones culturales/profesionales |
| Balance cromático | paleta de prendas, no solo color dominante | análisis visual precalculado | variable en estampados | fotos con luz diferente; contraste de tamaño |
| Proporción/volumen | fit, largo, categoría, estructura | ficha + heurística | media | caída sobre cuerpo desconocida |
| Texturas y acabados | tejido y brillo | metadatos explícitos/foto | baja-media | satén/lana no identificables por foto con seguridad |
| Foco/acento | color, patrón, superficie, brillo | heurística explicable | exploratoria | estética maximalista intencional |
| Compatibilidad térmica | tipo, grosor, manga, temperatura | estimación de clo ya existente | aproximada | viento, humedad, actividad, aislamiento real |
| Experiencia personalizada | favorito/rechazo/uso/preferencia explícita | estado local por perfil | alta para explícitos | sesgo de repetición y arranque frío |
| Coherencia global | conjunto entero + ocasión + estilo | agregador contextual/ML | **por medir** | doble penalización y overfitting |

**No convertir una señal exploratoria (por ejemplo, “un solo foco”) en restricción dura.** Mejor registrar su contribución y medir valor predictivo en parejas difíciles.

## 26. Fórmulas de outfit: plantilla, compatibilidad y personalización son tareas distintas

*Personalized fashion outfit generation with user coordination preference learning* separa preferencia por plantilla, preferencia por prenda y compatibilidad total, con varios pasos para producir outfits completos: https://www.sciencedirect.com/science/article/abs/pii/S0306457323001711 .

Para Atelier:
1. **Plantilla contextual**: decidir si la persona quiere vestido, top+pantalón, falda, capas, calzado, bolso y accesorios opcionales. También permitir preferencias temporales (“hoy pantalón”).
2. **Prendas candidatas**: priorizar piezas de armario real, talla/estado/disponibilidad cuando se conozcan, y proteger la prenda ancla si la persona inicia desde «Combinar prenda».
3. **Compatibilidad global**: valorar el conjunto *completo* y no solo suma de parejas.
4. **Reranking personal/diverso**: evitar cinco looks casi idénticos y alternar propuestas seguras/creativas sin sacrificar contexto.
5. **Feedback**: diferenciar no me gusta el look, no me gusta esta prenda, no quiero esto hoy y ya lo he usado.

La idea de un perfil construido **durante la interacción**, incluso sin preferencias anteriores, aparece en *Interactive Garment Recommendation with User in the Loop* (ACM TOMM, 2024): https://doi.org/10.1145/3702327 . No hace falta adoptar su arquitectura exacta: basta con experimentar con preferencias explícitas temporales.

## 27. Cómo conservar diversidad sin perder precisión

La literatura general de sistemas de recomendación investiga diversificación mediante reranking: https://doi.org/10.1145/3700604 . Ese estudio trabaja con otras categorías de producto, por lo que su efecto en moda sería una **hipótesis por comprobar**, no una evidencia directa.

Reranking ligero propuesto sobre un top-N válido:
- primero eliminar duplicados por ID de prenda y combinaciones equivalentes;
- escoger look 1 por compatibilidad/personalización;
- elegir siguientes maximizando calidad con un término de *novedad marginal* (categorías, prendas protagonistas, silueta, paleta);
- diversidad no debe forzar un look incorrecto por clima u ocasión;
- permitir preferencia «conservadora» frente a «quiero experimentar»;
- medir tasa de aceptación, variedad de prendas y descenso de compatibilidad por aumentar diversidad.

Una alternativa estándar para comparar es **Maximal Marginal Relevance (MMR)**, usando similitud interpretable (solapamiento de prendas/atributos), antes de usar un LLM costoso para reordenar.

## 28. Qué NO debemos aprender automáticamente

*Towards private stylists via personalized compatibility learning* introduce atributos físicos en un sistema de compatibilidad: https://www.sciencedirect.com/science/article/pii/S0957417423001331 . Es una línea de investigación, **no un requisito de Atelier**. Para nuestro producto es preferible no deducir cuerpo, color de piel, edad o medidas desde fotografías.

Solo utilizar preferencias de ajuste, comodidad y estilo **declaradas voluntariamente** por el perfil. No establecer “estiliza tu figura” como objetivo universal: una persona puede preferir siluetas voluminosas, rectas, fluidas o dramáticas sin buscar una apariencia corporal normativa.

## 29. Matriz de decisiones para un prototipo verificable

| Situación | Decisión razonable del motor | Prueba de control |
|---|---|---|
| Dos conjuntos igualmente válidos; uno favorito personal | preferir favorito sin impedir descubrimiento | personalización vs diversidad |
| Misma base, zapatillas técnicas vs mocasín | depende de actividad/código de vestimenta | oficina creativa vs entrevista formal |
| Dos estampados grandes | permitir si intención maximalista y hay cohesión | A/B con estilo declarado |
| Solo se conoce color dominante | no fingir paleta detallada de estampado | confianza en atributos faltantes |
| Abrigo visualmente bonito pero insuficiente a 5 °C | advertencia térmica y alternativa | seguridad funcional antes de estética |
| Cinco recomendaciones con mismo pantalón | reranking por novedad marginal | cobertura prendas y calidad |
| Usuario fija una falda como pieza principal | no sustituirla sin permiso | preservación de ancla |
| Un dislike casual hoy | no convertir en preferencia permanente | sesión vs historial |
| Rechazo por motivos de comodidad | evitar esa combinación cuando contexto coincida | preferencias explícitas |
| Falta información de caída/tejido | confianza baja en explicación | evitar “te sentará perfecto” |

**Plan de validación:** comparar un baseline (motor actual), un reranker MMR y un scoring contextual simple en los casos fáciles y difíciles del banco A/B; mantener fuera del entrenamiento la parte ciega. Registrar intervalos de incertidumbre y desacuerdos de jueces. No afirmar rendimiento superior hasta evaluarlo.
