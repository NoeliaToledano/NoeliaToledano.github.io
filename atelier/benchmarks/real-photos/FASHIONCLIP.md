# FashionCLIP real: primera integración experimental

FashionCLIP es un modelo **preentrenado real** alojado por sus autores en [Hugging Face](https://huggingface.co/patrickjohncyh/fashion-clip) (licencia de modelo indicada: MIT). El repositorio original presenta la API de Transformers: [GitHub](https://github.com/patrickjohncyh/fashion-clip).

Esta PR añade el **extractor real** (Python + Transformers), no una integración en el móvil ni resultados simulados. La inferencia **no se ha ejecutado en CI**, pues requiere descargar los pesos y disponer de fotografías autorizadas.

## Cómo ejecutarlo

Con Python compatible, en entorno virtual separado:

```sh
python -m pip install torch transformers pillow
python atelier/benchmarks/real-photos/fashionclip-export.py \
  --labels atelier/benchmarks/real-photos/labels-polyvore.json \
  --images-root atelier/benchmarks/real-photos \
  --output /tmp/atelier-fashionclip-embeddings.json
node atelier/benchmarks/real-photos/embeddings-to-pairs.mjs \
  atelier/benchmarks/real-photos/pairs-polyvore.json \
  /tmp/atelier-fashionclip-embeddings.json > /tmp/fashionclip-pairs.json
node atelier/benchmarks/real-photos/pairs.mjs --json > /tmp/atelier-baseline.json
node atelier/benchmarks/real-photos/model-compare.mjs \
  /tmp/atelier-baseline.json /tmp/fashionclip-pairs.json
```

La carpeta pública de GitHub del banco **no contiene por sí misma todas las fotos** bajo `img/`. Antes de ejecutar, proporcionar las imágenes auténticas correspondientes a `file` en el JSON y asegurarse de tener permiso de acceso y uso. El programa **falla explícitamente** si falta alguna fotografía, hay IDs duplicados o rutas de imagen que escapan de la carpeta autorizada. No envía fotos a APIs: procesa archivos locales; la biblioteca descarga el modelo la primera vez.

Las salidas son vectores generados por **FashionCLIP real**, pero el siguiente paso de similitud coseno inter-categoría es únicamente un **baseline de diagnóstico**, no un score de compatibilidad entrenado por FashionCLIP. No usar un resultado cosmético como demostración de que Type-Aware o una estilista neuronal supera al motor actual.

## Seguridad, derechos y rendimiento
- Usar solo fotografías cuya licencia o autorización permita el análisis. **No redistribuir** imágenes de Polyvore.
- Cachear vectores por hash de foto, modelo y versión; nunca recalcular en cada recomendación.
- Mantener pesos/dependencias fuera del bundle público y no subir datos de usuarias a terceros.
- Medir coste de extracción, cobertura, latencia y resultados con votos humanos **congelados**.
- Pruebas de lógica sin descarga: `python -m unittest discover -s atelier/benchmarks/real-photos -p 'test_fashionclip_export.py'`.

## Piloto reducido

Para empezar con solo fotografías autorizadas de dos looks, pasa sus IDs separados por comas usando `--ids ID1,ID2,...`. Solo se exige que existan los archivos de las prendas seleccionadas. **No se pueden pasar los vectores parciales al banco completo de 34 pares**: prepara un fichero de pares reducido cuyos conjuntos A y B tengan todas las prendas representadas. Declara esa cobertura en el informe. Este modo permite un ensayo técnico sin necesitar las 86 fotos originales.

## Trazabilidad

Cada ejecución genera, además de `embeddings.json`, un `embeddings.json.provenance.json` con identificador del modelo, dimensiones, IDs analizados y carácter diagnóstico del coseno. Conserva ambos ficheros juntos con la versión exacta del entorno Python/Transformers; evita comparar inferencias de pesos o versiones desconocidas. Estos metadatos no sustituyen comprobar licencia ni consentimiento para las imágenes.
