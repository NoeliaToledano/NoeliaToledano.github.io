# Auditoría visual de recomendaciones — Atelier

## Objetivo
Validar que el motor local y la sugerencia con IA proponen looks **ponibles, apropiados y atractivos**, no simplemente compatibles por color. Esta evaluación no debe utilizar prendas privadas de ningún usuario.

## Datos
1. **Control automático existente:** el test de seguridad genera armarios artificiales de 20, 100 y 500 prendas. Verifica diversidad, combinaciones completas, clima, ocasiones y tiempo de cálculo. **No** son fotografías ni validan estética.
2. **Banco visual externo candidato:** `Marqo/polyvore` (Hugging Face), con fotografías, categoría, texto e ID de prenda, y licencia del dataset Apache-2.0. Referencia: https://huggingface.co/datasets/Marqo/polyvore . Verificar los derechos de las imágenes originales antes de distribuirlas; usar una copia local para auditoría interna.
3. **Segundo control:** conjuntos previamente confeccionados de Polyvore/Maryland, usando ejemplos compatibles y negativos. Referencia: https://github.com/xthan/polyvore-dataset . Las URL originales de Polyvore están caducadas; no depender de ellas.

## Muestreo inicial reproducible
Elegir aproximadamente 1.000 prendas **diferentes** (sin confundir varias fotos del mismo outfit con prendas distintas), distribuidas entre arriba, abajo, vestido/mono, zapatos, capas, bolsos y accesorios. Etiquetar categoría, estación, ocasión, formalidad, color, patrón y tejido; auditar manualmente una muestra de esas etiquetas. Mantener las fotos **fuera del repositorio y fuera de los perfiles reales**.

Crear armarios de 20, 100, 500 y 1.000 prendas. Para cada tamaño, generar varias alternativas en: 8 °C, 17 °C y 28 °C; diario, trabajo, formal, fiesta, playa y casa; con y sin prenda obligatoria. Conservar temperatura, ocasión, prendas disponibles y versión del motor para repetir los resultados exactamente después de cada cambio.

## Evaluación
Registrar por cada propuesta: ID reproducible, armario, ocasión, temperatura, prendas elegidas, categoría, imágenes, puntuación del motor, puntuación humana de estética (1 a 5), ¿me lo pondría? (sí/no), motivo de rechazo y alternativa mejor disponible. Mostrar cada prenda en un recuadro, formando una cuadrícula visual.

**Fallos automáticos bloqueantes:**
- base inválida (falta arriba+abajo o vestido/mono);
- combinaciones imposibles por clima u ocasión (por ejemplo, gorro de invierno y chanclas);
- categorías redundantes o un accesorio impuesto que perjudica la coherencia;
- mismo look repetido con cambios triviales;
- prenda obligatoria omitida.

**Fallos que exigen revisión humana:** silueta, mezcla de estilos, formalidad, proporciones, combinación estética de estampados y elección de complementos. Una puntuación matemática alta **no** prueba que sea un buen outfit.

## Métricas
- Tasa de looks técnicamente válidos, separados por estación y ocasión.
- Porcentaje de looks aprobados por una persona (objetivo inicial de evaluación: 90 %, **no es un resultado observado**).
- Media y distribución de estética 1–5.
- Porcentaje con zapatos adecuados y porcentaje con bolso coherente, sin forzar categorías.
- Número de fallos graves, tasa de propuestas duplicadas y cobertura de prendas.
- Comparativa antes/después sobre **exactamente los mismos armarios y escenarios**.

## Regla de publicación
No modificar el motor exclusivamente para mejorar una métrica agregada. Toda regla nueva necesita un fallo reproducible y una prueba de regresión. Una muestra visual debe superar la revisión en móvil y escritorio; las pruebas automáticas deben seguir en verde. La mejora real requiere recopilar y revisar imágenes; hasta entonces la auditoría visual está **pendiente**, aunque pase la CI.

## Herramientas disponibles en el repositorio

Se han preparado tres herramientas para ejecutar este procedimiento localmente, sin modificar un perfil real:

```bash
pip install datasets pillow
python atelier/benchmarks/prepare_photo_bank.py --output ./look-benchmark --limit 1000
node atelier/benchmarks/evaluate-outfits.mjs ./look-benchmark/garments.json ./look-benchmark/looks.json
python atelier/benchmarks/render_looks.py ./look-benchmark/looks.json
```

El primer comando descarga un **catálogo fotográfico candidato**; las etiquetas inferidas por palabras necesitan corrección humana antes de interpretar los resultados. El segundo ejecuta el motor local en 72 escenarios (cuatro tamaños de armario, tres temperaturas y seis ocasiones) y conserva la puntuación y alertas de cada look. El tercero crea `review.html` para ver las prendas juntas y `review.csv` para anotar las valoraciones.

No subir a GitHub los directorios de fotografías, reportes o valoraciones; respetar condiciones de uso de las imágenes de origen. El test automático en CI utiliza 21 prendas de ejemplo para verificar el funcionamiento de este flujo, **no equivale a haber revisado 1.000 imágenes**.
