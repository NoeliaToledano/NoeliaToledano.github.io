# Atelier — estrategia del cerebro estilista (BORRADOR de consenso)

> **Estado: NO APROBADO**. Se deriva del documento compartido #159 y del seguimiento #158. Claude debe revisarlo y corregirlo antes de declararlo estrategia definitiva. No autoriza modificar `atelier.js` ni fusionar un motor paralelo.

## Objetivo de producto

Al crear/editar una prenda, ofrecer relaciones **útiles, explicables y contextuales** con las prendas existentes. Crear conjuntos de 1 pieza (vestido), 2 (arriba+abajo) o más si cada pieza opcional aporta valor, verificando el conjunto entero. No confundir buena relación de dos piezas con calidad de un grupo.

## Contrato y fuente de verdad

```text
Prenda + atributos/procedencia + reglas actuales
  -> pairEvidence(a,b) [hechos derivados, incertidumbre, razones]
  -> contextualizePair(edge, occasion, weather, profile)
  -> baseCandidates(topK; diversity; full wardrobe fallback)
  -> comboIdentity(group, context) [weak links + global style/season/formality]
  -> expandLook(group, optional): add only on functional need or measured gain
  -> existing scoreOutfit / rank & personal feedback
  -> UI: «Combina con» / Inspiración / swap / looks
```

**Sin segundo árbitro:** adaptar `pairColor`, `stylesOk`, `pairs`, `thermalOk`, `occasionFits`, `scoreOutfit`, `lookIssues`. El grafo #156 está cerrado como prototipo y **no** se incorpora tal cual.

### Semántica de los datos

- **Evidencia de arista**: determinista respecto a metadatos y versión del evaluador, con campos ausentes señalados. Ninguna etiqueta de «apto para trabajo» universal.
- **Contexto**: clima/ocasión/deseo de hoy + gustos del perfil alteran ranking, no hechos de la prenda.
- **Grupo**: no solo media de pares; detectar conflicto fuerte entre dos piezas esenciales, conjunto térmicamente inadecuado, patrones/paleta, formalidad y calidad de los elementos que sobran.
- **Feedback**: gusto personal, no etiqueta universal. Aprender causa del 👎 y conservar voto sobre look completo.
- **Almacenamiento**: aristas cache derivada por perfil, versión y firma de atributos; guardar preferencias/feedback/looks como fuente de verdad ya sincronizada. Evitar sincronizar O(n²) aristas y evitar guardar O(n³) hiperenlaces.

## Matriz de aceptación, que debe convertirse en tests

| Caso | Entrada/escenario | Comportamiento exigido |
| --- | --- | --- |
| Base mínima | Camiseta + pantalón compatibles, sin accesorios | El sistema puede recomendar exactamente 2 piezas; no forzar bolso, capa o pendientes |
| Vestido | Vestido único adecuado al contexto | Puede presentar base de 1 pieza; solo añade lo necesario |
| Tercera pieza | Camiseta + pantalón + blazer | Evalúa los 3 pares pertinentes y la coherencia global; no basta con combinar con 1 de 2 |
| Pieza perjudicial | Base correcta + accesorio que rompe la paleta | No se añade por disponibilidad, salvo pedido explícito con aviso |
| Frío | 8 °C, top sin mangas o corto | No se recomienda si incumple regla funcional; no lo rescata un buen color |
| Trabajo | Código `workDress=formal` vs `informal` | Misma pareja puede puntuar distinto; sin alterar metadatos compartidos |
| Incertidumbre | `pattern`, manga o grosor ausentes | No asumir lisa/abrigo/manga; mostrar incertidumbre, recomendar corregir ficha |
| 👎 con causa | Rechazo de conjunto «muy arreglado» | Afecta al perfil y al contexto, no penaliza globalmente esas prendas |
| Prenda nueva | Añadir prenda de arriba | Recalcular solo aristas incidentes; mostrar vecinos y bases viables |
| Edición | Cambiar color/estilo/estampado de una pieza | Invalidar aristas que dependan de ella, conservar otras |
| Eliminación / sync | Borrado remoto o cambio en otro dispositivo | No aparecen aristas obsoletas ni prendas eliminadas |
| Independencia | Perfiles con gustos opuestos | Índice de evidencia aislado por perfil; feedback nunca cruza perfiles |
| Volumen | 10, 100 y 500 prendas | Medir latencia y memoria en dispositivo real/Safari; ninguna búsqueda combinatoria ilimitada |
| Diversidad | 30 prendas similares + 1 estilo distinto | No monopolizar propuestas por orden de IDs o por primera fórmula |
| Inspiración | Foto de look aportada por usuaria | Buscar prendas equivalentes, revisar contexto y permitir ajustar, sin guardar fotos externas sin permiso |
| Evaluación | Parejas de desarrollo vs nuevos votos congelados | Nunca afirmar mejora sobre los mismos ejemplos usados para ajustar reglas |

## Experimentos y métricas obligatorias

1. **Baseline de producción**: número de recomendaciones válidas, calidad por voto ciego, tasa de looks sobrecargados, % de repeticiones y cobertura de prendas.
2. **Red contextual**: proporción de relaciones con motivos suficientes y frecuencia de contradicciones con `scoreOutfit` / reglas duras.
3. **Composición**: mejora real en elecciones humanas sobre el baseline, penalizaciones por elemento irrelevante, eslabón más débil.
4. **Rendimiento**: latencia de subida/edición, generación top-3 y consumo de memoria con 10/100/500 prendas; anotar dispositivos y versiones.
5. **Datos incompletos**: comparar `degrade.mjs` y probar expresamente manga, ocasión y grosor ausentes.
6. **Privacidad**: que el cálculo de relaciones no requiera enviar cada combinación a OpenAI, ni filtrar armario o fotos entre perfiles.

**Sin objetivos numéricos inventados:** presupuestos exactos de latencia y umbral de mejora estética se fijarán entre ambos tras medir el baseline en iPhone/WebKit. Aprobar CI verde no certifica calidad de estilismo.

## Secuencia propuesta de PR pequeñas

- **0. Auditoría:** cerrar #159 cuando Claude/ChatGPT acuerden E1–E12 y revisen evidencias FashionCLIP; cerrar/desestimar módulos duplicados.
- **1. Contrato**: una API de evidencias de relación derivada del motor real; tests contra funciones actuales.
- **2. Rendimiento**: invalidación/caché incremental, benchmarks 10/100/500 prendas, sin backend adicional.
- **3. Calidad de conjuntos**: identidad y eslabón débil, extras según contribución marginal y necesidad funcional.
- **4. UX**: mostrar relaciones al subir/editar, explicación y cambio de prenda, feedback.
- **5. Evaluación ciega**: armarios cápsula y votos de varias personas, controles Safari, activar gradualmente con rollback.

## Reparto a ratificar

**Claude**: núcleo de estilismo y experiencia (`atelier.js`, `atelier-api` si necesario), reglas por contexto, revisión #157, corpus humano.
**ChatGPT**: contratos, verificación semántica, caché e invalidación independientes, benchmarks de rendimiento y calidad, test matrix.
**Ambos**: revisión cruzada, y nadie fusiona PR del otro antes de que el autor resuelva avisos de revisión; `AGENTS.md` tiene prioridad.

## Decisiones que siguen abiertas

- Interfaz exacta de la rama Claude `red-relaciones` y compatibilidad con la puntuación actual.
- Qué funciones son *obligatorias* según ocasión/temperatura y cuáles realmente opcionales.
- Qué umbral de ganancia marginal introducir y cómo se explica sin sobrecargar UX.
- Caché IndexedDB vs memoria, capacidad, algoritmo de invalidación/sync.
- Resultados y comandos reproducibles de FashionCLIP local (fotos permanecen privadas).
- Tamaño y fechas del test ciego nuevo, separado del banco que sirvió para ajustar reglas.


## Principio de producto confirmado por Noelia (10/10/2026): núcleo coherente, extras subordinados

**Definición del look:** su centro es (a) una pieza enteriza como **mono o vestido**, o (b) **una prenda superior + una inferior**. Todas las otras prendas se evalúan como posibles contribuciones a esa composición, no como categorías obligatorias que haya que rellenar.

**Orden conceptual** (no fuerza orden visual ni obligación de incluir):
1. **Base principal**: una pieza enteriza o arriba+abajo. Evaluar primero la cohesión de color, corte, textura, formalidad y proporciones.
2. **Capas**: abrigo, chaquetilla, americana, cárdigan y similares, según **temperatura, función y coherencia**. Una necesidad térmica puede obligar a recomendar una capa o advertir que la base no es viable; no debe justificarse una capa incompatible por el mero hecho de tener frío.
3. **Zapatos**: son una necesidad práctica al salir, **pero su presencia en la composición visual debe aportar valor y combinar**. No incluir un zapato mediocre solo para rellenar una casilla; buscar una alternativa, permitir mostrar el conjunto de ropa como base o advertir que falta calzado adecuado cuando el contexto lo exige.
4. **Bolso y otros accesorios**: completamente opcionales salvo una necesidad expresamente seleccionada. Solo añadir cuando combinan con **todas las piezas relevantes** y mejoran el conjunto; no puede rescatarse un choque central con accesorios bonitos.

**Invariante principal: coherencia global antes que número de prendas**. No basta con que un elemento sea compatible con el ancla; comprobar su relación con el resto y el resultado grupal. Una propuesta de 2 prendas excelente es mejor que una de 6 incoherente.

### Requisitos verificables adicionales
- [ ] Mono identificado como pieza enteriza, no tratado por defecto como una parte de arriba; idem vestido. Comprobar taxonomía actual (`Vestidos`, `type/subtype`) antes de modificarla.
- [ ] La ampliación de un conjunto de 2 a 3 prendas *debe* justificar valor funcional o mejora visual/contextual. No hay bonificación automática por completar más categorías.
- [ ] Una capa térmica que choca estéticamente produce búsqueda de alternativas o aviso, no un “look perfecto” falso.
- [ ] Zapatos útiles pero discordantes no se incorporan como propuesta estilística por obligatoriedad; diferenciar presentación parcial y look completo para salir.
- [ ] Bolso o accesorios compatibles con una prenda pero no con el resto se descartan.
- [ ] Si no hay extras adecuados, presentar únicamente la base viable, claramente etiquetada, sin penalizarla por el número bajo de piezas.
- [ ] Explicaciones de cada añadido: «protege del frío», «equilibra la silueta», «repite un tono», «aporta formalidad», etc. Deben surgir de señales reales, no motivos inventados.
- [ ] Votos A/B para comparar look minimalista coherente vs look sobrecargado y para contrastar contextualización formal/casual, sin ajustar y certificar con el mismo lote.

**Regla de aceptación**: la composición se valida como **unidad**. Compatibilidad por pares = condición de apoyo, nunca prueba suficiente de coherencia global. Se deberá adaptar `completeOutfitGreedy`/`completeOutfit` para que no añadan extras solo por disponibilidad.


## Contraste de Claude recibido — acuerdo sobre arquitectura, calibraciones aún provisionales

Claude respondió a las preguntas de #159 (comentario 10/10): **acepta E7–E12 y la separación** `pairEvidence` (evidencias + incertidumbre) → `contextualizePair` (ocasión, clima, perfil/feedback) → `comboIdentity` (todo el grupo) → `expandLook` (necesidad o mejora). Rehará su prototipo para evitar una puntuación paralela a las reglas de producción.

| Tema | Consenso operativo | Requiere verificar |
| --- | --- | --- |
| Evidencia | Reutilizar `pairColor`, `styleAffinity`, `formalLevel`, `occasionFits`, temporada, térmica y restricciones. No mezclar 👎 en evidencia permanente | Ausencia de reglas contradictorias entre APIs |
| Pieza opcional | Solo por necesidad contextual o ganancia global. **Propuesta inicial de Claude:** Δscore ≥ 1 punto y relación ≥ 0,6 con cada pieza relevante | Umbrales calibrados con votos; evitar sobreconservadurismo y mezclas estilísticas intencionadas |
| Eslabón débil | No promediar conflictos. Claude propone aviso cuando mínimo entre relevantes < 0,4 y rechazo de ampliación con algún enlace < 0,6 | Caso de 5 prendas con cuatro enlaces buenos y uno malo; contextos con estética intencional |
| Calzado/capa | Si son necesarios por contexto, buscar opción coherente; si no existe, **base parcial + aviso**, nunca fingir que el look de calle está resuelto | Diferenciar necesidades de usar zapatos y visualizarlos en el conjunto |
| Cache | Claude tiene firma global perezosa que es correcta pero recalcula de más; ChatGPT diseña invalidación incremental **por prenda afectada** | Actualización remota/importación/borrado/reglas, aislamiento perfiles |
| Performance | Claude refiere ≈ 320 ms en Node con 100 prendas en modo ligero | Ejecutar medición verificable y Safari/iPhone; no extrapolar Node al dispositivo |
| Modelo visual | FashionCLIP probado offline por Claude, reconocimiento mejor que formalidad, **no juez de estilo** | Resultados reproducibles sin fotos, licencias, costes, test independiente |
| Evaluación | 3–4 armarios cápsula de 25–40 prendas + eventual armario real autorizado; evaluación humana congelada | No solicitar fotos privadas hasta contar con un proceso explícito de consentimiento; no tocar reglas usando lote congelado |

### Condición de aceptación: coherencia, no completitud

Los tests deben probar conjuntamente:
1. Una base con vestido/mono o arriba+abajo **puede ganar sin extras**.
2. Añadir blazer adecuado al frío puede mejorar la función sin romper la coherencia estética; uno inadecuado se rechaza o se advierte si no hay alternativa.
3. **Caso 4+1:** prenda nueva buena con cuatro piezas aisladas, pero incompatible con una quinta relevante ⇒ se rechaza; no compensar el conflicto con medias.
4. El look mantiene la **identidad contextual** tras cada añadido; no se presenta como apto para trabajo/fiesta si cualquiera de las piezas relevantes incumple las restricciones.
5. Los cambios de gusto personales no editan el dato general del par ni contaminan otros perfiles.
6. La caché no tarda O(n²) en una **edición incremental típica**, aunque la generación inicial pueda evaluar muchos pares. Registrar coste real con 10, 100 y 500 prendas.

**Estado:** coincidencia explícita de diseño en #159; no implica que los umbrales ni la implementación estén aprobados o validados. Acordar pruebas y revisión cruzada antes de fusionar PR de producto.


## Cuatro precisiones acordadas con Claude para comenzar (10/10)

1. **Paso 0b — Calidad de datos antes del grafo.** Ya está fusionada #157: el análisis pide manga, grosor y abrigo. Queda pendiente validar esos campos antes de recomendar prendas cuando la temperatura sea extrema y permitir completarlos rápidamente desde la ficha.
2. **Pruebas con armarios coherentes desde el principio.** Construir varios armarios cápsula de 25–40 prendas con estilos definidos; no usar un saco aleatorio de prendas para evaluar si un estilista combina bien. Solicitar autorización antes de usar un armario real.
3. **«Combina con» inmediatamente después de guardar una prenda.** Es un objetivo principal de producto tan pronto como existan relaciones contextualizadas. Agrupar alternativas de día a día, trabajo y fiesta; mostrar qué aporta cada combinación y por qué podría no funcionar.
4. **Calzado práctico frente a recomendación de estilo.** Si no existe calzado coherente para salir, etiquetar expresamente «Look (sin calzado que combine)». No inventar que el conjunto está completo.

**Primer desarrollo paralelo:** Claude revisa el motor principal y el UX; ChatGPT entrega en #161 un módulo de caché local/incremental sin segundo motor de puntuación. La caché es en memoria inicialmente (no IndexedDB todavía) y no se usa aún en producción: conectar después de cerrar el contrato con Claude y evaluar los tiempos y la privacidad.
