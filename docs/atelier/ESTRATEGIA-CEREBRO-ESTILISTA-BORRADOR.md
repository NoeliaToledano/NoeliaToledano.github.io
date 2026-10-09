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
