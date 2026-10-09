# Benchmark de compatibilidad externa — guía reproducible

Esta carpeta permite comparar clasificadores de compatibilidad con Atelier sin introducir redes neuronales en la PWA.

## 1. Generar baseline
```sh
node atelier/benchmarks/real-photos/pairs.mjs --json > /tmp/atelier-pairs.json
```

Los scores y las restricciones `va/vb` vienen del mismo motor y de los mismos escenarios.

## 2. Producir puntuaciones externas reales

El adaptador espera vectores precalculados por un modelo que el experimentador haya ejecutado **realmente**. No descarga pesos, no hace llamadas de red y no ejecuta Type-Aware por sí mismo.

```sh
node atelier/benchmarks/real-photos/embeddings-to-pairs.mjs \
 atelier/benchmarks/real-photos/pairs-polyvore.json /tmp/embeddings.json > /tmp/external.json
```

Formato de `embeddings.json`: objeto por ID, p. ej. `{"item1":{"type":"Zapatos","vector":[0.5,0.25]}}`. Los vectores deben pertenecer al mismo espacio y la misma versión del modelo. El adaptador calcula coseno **entre categorías diferentes**, un *baseline diagnóstico*, no el algoritmo original Type-Aware. Si el modelo ya calcula scores de outfit, es preferible exportar directamente `[{id,sa,sb}]` conforme al contrato de `model-compare.mjs`.

## 3. Evaluar
```sh
node atelier/benchmarks/real-photos/model-compare.mjs /tmp/atelier-pairs.json /tmp/external.json > /tmp/comparison.json
node atelier/benchmarks/real-photos/model-compare.test.mjs
node atelier/benchmarks/real-photos/embeddings-to-pairs.test.mjs
```

Ambos rankers aplican las mismas restricciones capturadas en `va/vb`. Las restricciones de gusto subjetivo que el motor pudiera considerar duras deben revisarse antes de declarar una victoria estética.

**Limitaciones importantes:**
- Los 33 votos de Noelia ya han inspirado cambios del motor; son un conjunto de *desarrollo*, no un test independiente.
- Un 0.8 de una red no se compara directamente con un 80 de nuestro score. Se comparan decisiones y, más adelante, resultados en test congelado.
- No asegurar mejora sin ejecutar un modelo externo y valorar sus predicciones.
- No cargar fotografías privadas ni redistribuir imágenes de Polyvore sin tener derechos adecuados.
- Publicar resultados con identificador del modelo, versión de pesos, fuente y partición de datos, procedimiento de extracción, cobertura de prendas y tiempo de inferencia.
