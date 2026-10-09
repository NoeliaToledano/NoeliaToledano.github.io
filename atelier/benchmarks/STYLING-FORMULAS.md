# Fórmulas de estilismo — banco experimental

`styling-formulas.mjs` genera candidatos completos a partir de **cinco plantillas genéricas**, sin redes neuronales ni copiar imágenes de Pinterest, revistas o influencers.

Cada plantilla describe prendas necesarias, contexto y estilo; `generateFormulaCandidates` busca coincidencias en un inventario de prendas y devuelve IDs. El resultado **no es un look recomendado** hasta que el motor existente aplique clima, ocasión, restricciones, preferencia individual y diversidad.

Estas cinco plantillas son **ejemplos originales de ingeniería**, no fórmulas extraídas ni validadas de una revista concreta. Para incorporar referencias editoriales reales es necesaria una fuente identificada, fecha, técnica observada y respeto de derechos.

```sh
node atelier/benchmarks/styling-formulas.test.mjs
```

Siguiente experimento: alimentar las plantillas con prendas disponibles; comparar candidatos frente a `rankOutfits` y obtener votos ciegos sin ajustar a partir del mismo banco. Incorporar el generador a producción **solo si las pruebas favorecen sus propuestas**.

**Restricciones actuales:** exige tipos/estilos explícitos para algunos slots, no infiere proporciones por visión, no aprende nuevas fórmulas y no se conecta automáticamente al armario del usuario. Las plantillas y la evaluación se mantienen offline en `benchmarks/`.
