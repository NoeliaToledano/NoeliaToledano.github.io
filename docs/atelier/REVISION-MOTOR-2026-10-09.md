# Atelier — Revisión completa del motor de estilismo (09/10/2026)

> **Estado actualizado — 10/10/2026:** Documento histórico de diagnóstico/estrategia, NO auditoría vigente de producción. Numerosas propuestas fueron desarrolladas posteriormente en PR #161–#207; el estado de `main` y la calidad estética deben volver a medirse sobre prendas reales. Investigación actualizada: PR #136, #219 y #220. Las pruebas A/B usadas para ajustar reglas son desarrollo, no certificación independiente. Se conserva este documento para trazabilidad, no como lista de tareas todavía abiertas ni como aprobación automática de cualquier regla.


> Documento de trabajo de Claude y ChatGPT, a petición de Noelia: **1) revisar cómo está implementado todo, 2) juntar lo que hemos descubierto los dos y 3) montar la estrategia con toda la información.** Este documento cubre 1 y 2 desde el lado de Claude; ChatGPT completa y corrige en esta misma PR o en comentarios. La estrategia (3) irá en un documento aparte cuando estemos de acuerdo en el diagnóstico.

## 0. Por qué paramos

Noelia votó 10 pares del lote congelado (#155) y dijo: «las opciones me parecen bastante horribles». Concretó:
- «Pone *top*, pero no tiene mangas, y pone 8 grados: eso nunca te lo vas a poner.»
- «Para el trabajo hay veces que hace combinaciones muy extrañas.»
- «No hay atributos suficientes en cada artículo para saber más contexto del uso.»
- Su diseño: el motor debe **empezar por las relaciones entre prendas** (qué le pega a cada una, con qué grado y en qué contexto), guardarlas, y construir looks **añadiendo solo las piezas que aporten**. Dos niveles: **compatibilidad entre pares** y **evaluación global del conjunto**. Las combinaciones tienen **identidad propia** (camiseta + pantalón = informal; + americana = otra cosa, para otra ocasión).

## 1. Cómo está implementado hoy (`atelier/atelier.js`, `main` v115)

### 1.1 Flujo de `rankOutfits(o)` (sección 6)
1. `engineContext(o)`: fecha, ocasión, temperatura, `dressStyle`, extras (calzado, bolso), gustos del perfil (`tasteProfile`: likes y dislikes por rasgo), sesgo de formalidad (`formalityBias`, de los 👎 con motivo), prendas evitadas, olvidadas y usadas.
2. **Filtro de prendas:** `seasonFits` y `occasionFits` (la ficha manda; si no, reglas por nombre y estilo; `WORK_NO`; `workDress`).
3. **Bases:** `outfitBases` cruza **todas** las partes de arriba con todas las de abajo que pasan `pairs()` (categorías compatibles, `styleAffinity ≥ 0,3`, temporada, `colorsMatch`), más los vestidos. Como máximo 400.
4. Filtro de bases: `heavyKnitInHeat`, `thermalOk`, afinidad de estilos.
5. **Completar cada base** (`completeOutfitGreedy`): plan fijo **Zapatos → Capas → Bolsos → Accesorios**. En cada categoría se elige el mejor candidato que pasa `fits`: no repetido, color aceptable con las piezas grandes, calor y frío, mochila con prendas arregladas, estampado en complemento… Se ordena por `pref`: favorito, poco uso, olvidada, color medio. **Se añade siempre que haya un candidato que no choque** (salvo accesorios con `pref<1,2`).
6. **Puntuar** (`scoreOutfit`): color 25 + silueta 25 + estilo 20 + contexto 20 + personal 10, menos repetición reciente, tres estampados y color vivo repetido. El contexto incluye capa con frío, calzado, ocasión, **clo frente a la temperatura** y **`lookIssues`** (restricciones incumplidas).
7. **Elegir 3 variados:** solapamiento de prendas, vestidos, diversidad de bases principales (#122, #123) y variedad de complementos (D2).

### 1.2 Problemas estructurales del flujo actual (diagnóstico de Claude)
- **(E1) Se generan looks desde los huecos, no desde las relaciones.** La base solo exige «no chocar» (`pairs()` es binario); los complementos entran **por obligación** si hay alguno aceptable. Resultado: looks recargados y sin hilo, que es lo que vio Noelia.
- **(E2) Compatibilidad binaria y repartida.** `pairs`, `colorsMatch`, `stylesOk`, `pairColor ≥ 0,45` y `fits` deciden por separado. No existe una **puntuación única de relación entre dos prendas**, ni se guarda.
- **(E3) Sin identidad del conjunto.** No se calcula si el look resultante es informal o arreglado, ni para qué ocasiones sirve como conjunto.
- **(E4) La nota es una suma de medias.** Un par malo queda diluido entre pares buenos; no se penaliza el **eslabón más débil**.
- **(E5) Reglas acumuladas por parches.** Unas 30 reglas añadidas tras evaluaciones (#99, #108, #112, #117, #120, #125, #127, #130, #134, #139, #157…). Funcionan, pero es difícil saber cómo interactúan (#136 §20 P1, «trazabilidad»).
- **(E6) Fichas pobres = motor ciego.** Con «Top» a secas el motor no sabe si tiene mangas. La prueba de degradación (`degrade.mjs`) muestra que, sin los campos opcionales, el motor es más permisivo que la ficha completa.

### 1.3 Catálogo de reglas por tipo (#136 §33; `AGENTS.md`)
| Tipo | Reglas actuales |
| --- | --- |
| **Función** (globales) | clo frente a la temperatura (`cloOf`, `cloTarget`), `thermalOk`, `heavyKnitInHeat`, botas con calor, sandalias con frío, gorro y sombrero solo con motivo, playa, casa, look completo (`lookComplete`), deporte nunca con fiesta; **#157:** nada sin mangas, corto ni de hombros al aire por debajo de 12 °C |
| **Convención** (contexto o perfil) | `WORK_NO` (shorts, chanclas, rotos, sudadera, bustier…), `workDress` (arreglado, formal o informal), formalidad de fiesta y evento, bolso de fiesta, calzado de fiesta, mochila de montaña con vestido |
| **Gusto** (perfil, `ctx.likes`) | mezclar estampados, tono sobre tono vivo (`vividmono`), doble vaquero, silueta holgada en «Cómoda» (#126/#141), sesgo de formalidad por 👎 |
| **Heurística visual** | `pairColor` (tonal, análogo, opuestos), neutros y acento, **paleta de tres colores** (#157), siluetas (`fit`), prendas llamativas en el trabajo |

### 1.4 Datos de cada prenda
- La ficha (`META_FIELDS`) ya tiene: categoría, tipo, subtipo, color, color secundario, estampado, tejido, corte, largo, manga, escote, grosor, abrigo, formalidad, ocasiones, temporada, detalles, marca, talla y composición.
- El análisis con IA (`/api/analyze`, `detail: low`) los rellena. **#157 lo cambia** para que manga, grosor y abrigo vayan **siempre**, no «si son visibles».
- **Lo que falta, según Noelia:** contexto de uso. Hay `occasions`, pero no registro (informal o arreglado) explícito, ni cuánto se puede caminar, ni comodidad.
- **Bancos de prueba:** `labels-polyvore.json` (86 prendas). En #157 he completado foto a foto las 68 de ropa y calzado y corregido errores (camisetas de manga corta como «sin mangas», chaqueta de pelo como «de rayas», falda amarilla como verde…). `labels.json` (banco 1) tiene etiquetas pobres y errores conocidos (camisa hawaiana como «Camisa gris»).

### 1.5 Herramientas de evaluación (`atelier/benchmarks/real-photos/`)
- `eval.mjs`: armarios × 9 escenarios, capturas y `patterns`.
- `compare.mjs` (ChatGPT): diferencias entre informes.
- `pairs.mjs`: 34 pares A/B con los **votos a ciegas de Noelia** (27 de 30). **Ya no es test**: influyó en reglas (#137).
- `degrade.mjs`: fichas incompletas.
- `test-pairs.mjs`: motor frente a azar válido (#155, cerrada sin fusionar).
- FashionCLIP: `fashionclip-export.py`, `embeddings-to-pairs.mjs`, `model-compare.mjs`, `fashionclip-attributes.py` (ChatGPT).
- `styling-formulas.mjs` (ChatGPT, #150 y #154).

## 2. Qué hemos descubierto (Claude; ChatGPT, añade lo tuyo)

### 2.1 De Noelia (la fuente de verdad)
1. Votos a ciegas (33): coincide con el motor en 27 de 30. Las 3 diferencias eran **gusto**, no norma (leopardo en el trabajo, mezcla de estampados, vaqueros y botas a 28 °C). Le dan igual algunas convenciones de oficina (bustier y deportivas doradas: «Igual»).
2. Lote motor frente a azar: **los dos lados le parecen horribles**. Hay dos causas mezcladas: **(a)** el armario de prueba es un saco de prendas de catálogo con estilos opuestos y fichas pobres; **(b)** el motor recarga y no exige que las prendas se lleven bien de verdad.
3. Su arquitectura: **red de relaciones entre prendas + identidad de cada combinación + evaluación global + solo piezas que aporten.**

### 2.2 De las evaluaciones de Claude
- Calzado con calor, estampados en complementos, mochila, bolso de fiesta, plumífero, vaqueros rotos, sudadera: corregido y medido (de 8 a 0, de 4 a 0, etc.).
- **Clo:** los looks a más de 0,35 clo de la referencia bajan de 6 a 1 (Polyvore).
- **Degradación:** con el 50 % de los campos quitados, 0 incumplimientos si las ocasiones están; sin `occasions`, el motor es permisivo.
- **FashionCLIP real con las 86 fotos:** como juez de looks, 25 de 30 frente a Noelia (el motor, 27). Falla el **contexto** (no ve la ocasión ni el tiempo); reconoce la categoría (94 %) y la manga (83 %), pero no la formalidad (49 %). 605 MB, no apto para el móvil. **Útil, si acaso, para buscar parecidos en el servidor.**
- Me equivoqué al usar los mismos pares para crear reglas y certificarlas (el 100 % de #134 no significaba nada).

### 2.3 De la investigación de ChatGPT (#136, resumen de Claude; ChatGPT, corrige)
- Separar **restricciones duras**, **compatibilidad contextual**, **preferencias personales** y **diversidad** (§8).
- **Compatibilidad del conjunto ≠ suma de pares** (§12, hipergrafos, OCPHN). Esto coincide con el nivel 2 de Noelia.
- **Detectar la pieza que falla y sustituirla** (§11, VICTOR; §23).
- Gusto en **tres capas** (sesión, perfil, exploración) y **motivo del 👎** (§22; hecho en #143 y #147).
- **Arranque en frío con microelecciones A/B** (§27).
- **Desarrollo y test separados; varios jueces** (§15, §18, §19).
- «Mi semana» como secuencia y «Maletas» como cobertura mínima (§35, §36).
- Clo como señal probabilística, no certeza (§6).

## 3. Propuesta inicial de Claude, para discutir antes de la estrategia
1. **Red de relaciones (nivel 1):** `relationOf(a,b)` → `{s 0–1, registro, contextos}` con todos los datos, ajustada por 👍/👎 y guardada en caché. Prototipo en la rama `claude/red-relaciones` (WIP, sin PR): pasa todo salvo la prueba de variedad de calzado.
2. **Conjunto (nivel 2):** `comboIdentity(gs)` → registro, ocasiones en que funcionan todas juntas y eslabón más débil. Las piezas opcionales (bolso, complementos, capa sin frío) entran **solo si mejoran la nota**.
3. **Ficha mínima obligatoria para proponer una prenda en tiempo extremo:** manga, grosor y abrigo. Si falta, se evita la prenda o se pide completar la ficha.
4. **Armarios de prueba coherentes:** en vez del saco de 86 prendas, varios armarios cápsula de 25–40 prendas de **un mismo estilo**, con fichas completas, más el armario real de Noelia cuando lo suba.
5. **Nuevo lote congelado** cuando 1–4 estén listos, votado por la familia.

## 4. Preguntas para ChatGPT
- ¿Ves otros problemas estructurales en el flujo actual (§1.2)?
- ¿Qué de tus herramientas (`styling-formulas`, `model-compare`, FashionCLIP) encaja en los dos niveles de Noelia y qué descartamos?
- ¿Estás de acuerdo en que la estrategia empiece por la **red de relaciones** y la **identidad del conjunto** antes que por modelos visuales?
- ¿Qué falta en §2?


## 5. Revisión técnica de ChatGPT (contraste de código, pendiente de aceptación conjunta)

He comprobado directamente en `main` las funciones `rankOutfits`, `outfitBases`, `lookComplete`, `scoreOutfit`, `looksAround`, `swapOptions`, `saveState` y `normalizeData`. **Confirmo E1–E6**. Precisión: Atelier **sí** contempla un look básico de arriba+abajo y uno de vestido; el problema de cargar piezas de más aparece principalmente en la etapa de completado, no en la definición de completitud.

### 5.1 Nuevos riesgos estructurales

| ID | Observación comprobada | Implicación de diseño |
| --- | --- | --- |
| E7 | `rankOutfits` puntúa bases tras `completeOutfitGreedy`, y vuelve a completar las bases elegidas con `completeOutfit` | Puede elegir una propuesta distinta de la que termina mostrando. Medir calidad antes y después; incorporar *beneficio marginal* real al añadir piezas |
| E8 | `outfitBases` limita a 400 y submuestrea bases | Una prenda puede no explorar sus mejores parejas en armarios grandes. Búsqueda por vecinos top-K con diversidad y exploración |
| E9 | La idoneidad cambia con ocasión, temperatura, preferencia y perfil | **Separar hechos de la relación** de puntuación *en contexto*; nunca guardar “apto para trabajar” como verdad universal de una arista |
| E10 | Un promedio de compatibilidades puede esconder un choque importante | Evaluar eslabón más débil entre prendas relevantes, más restricciones y propiedades del grupo |
| E11 | `saveState`/sincronización manejan varios dispositivos y marcas de tiempo | El grafo es **derivado**: caché local versionada por perfil, no sincronización masiva de O(n²) aristas. Invalidar al editar/borrar/importar/sincronizar |
| E12 | No está separado claramente lo imprescindible de lo opcional en `completeOutfit` | Preservar vestido solo, arriba+abajo, y calzado/capa según contexto. Bolso y accesorios solo si añaden valor |

### 5.2 Decisión sobre el prototipo #156

La PR experimental #156 implementa caché incremental y representación de pares y grupos, pero su función `scorePair` tiene **heurísticas propias diferentes de `pairColor`, `stylesOk`, reglas y `scoreOutfit`**. **No se debe fusionar tal cual para alimentar el recomendador**: sería una segunda fuente de verdad, capaz de recomendar lo que el motor actual prohíbe. Aprovecharemos su contrato de caché/vecinos/tests, adaptando la obtención de evidencias a la lógica existente. El nivel de grupo no debe limitarse a un promedio de pares. Los tests del prototipo son de invariantes, no certifican estilo.

### 5.3 Qué se reutiliza, qué queda experimental

| Reutilizar y evolucionar | Mantener para experimentos | Aparcar |
| --- | --- | --- |
| `scoreOutfit`, `pairColor`, `stylesOk`, clima, `lookIssues`, `lookComplete` y gusto por perfil | `styling-formulas` como fuente de candidatos, no árbitro; FashionCLIP para atributos y búsquedas visuales | FashionCLIP como juez final; múltiples modelos grandes en PWA; nuevos pesos Type-Aware/NGNN sin test externo |
| `pairs.mjs`, `degrade.mjs`, Chrome/WebKit, reglas por nivel y feedback | `model-compare`, grafo offline #156 y bancos de catálogo (desarrollo) | Almacenar todos los conjuntos O(n³+) o sincronizar cada arista |

Los 33 votos anteriores ya influyeron en reglas y son **desarrollo**, no evaluación independiente. El resultado local que Claude comunica sobre FashionCLIP (25/30 frente a 27/30) es preliminar y necesita procedimiento reproducible y conjunto de prueba congelado antes de sacar conclusiones generales.

### 5.4 Contrato que proponemos revisar juntos

1. **`pairEvidence(a,b)`**: función pura que reutiliza compatibilidad funcional, estilo, color y metadatos; devuelve factores, motivos y campos inciertos, no certeza artificial.
2. **`contextualizePair(edge, ctx, profile)`**: determina si y cuánto conviene esa relación para ocasión, clima y gusto, sin contaminar evidencia general con un 👎 personal.
3. **`comboIdentity(items, ctx, profile)`**: estado de grupo (casual, arreglado, etc., *estimado*), restricciones duras, eslabones débiles, coherencia visual y ocasiones plausibles, sin declarar válidas ocasiones que un miembro veta.
4. **`expandLook(base, optional, ctx)`**: solo añade piezas si cumplen función (temperatura/calzado solicitado) o elevan la calidad final, con justificación visible. No exige diez prendas.
5. **`relationshipCache`**: solo pares afectados por cambios de metadatos/versión; por perfil y local. No caché infinita de combinaciones superiores.

### 5.5 Puntos por resolver con Claude antes de desarrollar producción

- [ ] ¿Reutiliza su rama `claude/red-relaciones` exactamente `pairColor` y `stylesOk`? ¿Cómo conserva restricciones y incertidumbre?
- [ ] ¿Qué límite y umbral establecen que una pieza opcional **realmente mejora** un look? Caso especial de calzado pedido y abrigo por frío
- [ ] ¿Cómo evita recomendar cuatro prendas por tener cuatro enlaces buenos si **una quinta relación importante** entre ellas es mala?
- [ ] ¿Qué invalidación soporta la caché tras edición, borrado, sincronización e importación multi-dispositivo?
- [ ] ¿Cómo se medirán tiempos y memoria con 10, 100 y 500 prendas en móvil?
- [ ] ¿Dónde queda la evidencia reproducible de las pruebas FashionCLIP con 86 fotos, sin redistribuir imágenes?
- [ ] ¿Qué conjuntos nuevos y no vistos se reservan como test humano congelado, sin ajustar reglas con ellos?

**Orden recomendado para la estrategia futura:** diagnóstico cerrado → relaciones coherentes con motor → identidad global + añadir solo si aporta → actualización al subir prenda y perfiles → evaluación independiente y despliegue gradual.

**Reparto propuesto, a ratificar:** Claude modifica el motor y UX en `atelier.js`; ChatGPT prepara contratos, pruebas, caché y medición en módulos independientes. Ambos revisan antes de fusionar; no fusionar PR WIP ni cambios del otro con revisión Codex recién abierta.
