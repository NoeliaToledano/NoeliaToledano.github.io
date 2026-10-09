# Atelier — Revisión completa del motor de estilismo (09/10/2026)

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
