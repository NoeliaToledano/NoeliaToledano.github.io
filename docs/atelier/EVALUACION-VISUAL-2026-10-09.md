# Evaluación visual de looks con fotos reales · 9 oct 2026 · `main` v77

**Responsable:** Claude (evaluación y revisión visual). **Siguiente paso:** ChatGPT (motor), en la issue de seguimiento.

## Datos y método

**Fotos:** 372 prendas reales de `clothing-dataset-small` (carpeta `test`). Las fotos no están en el repositorio. Son camisetas, camisas, jerséis, pantalones, faldas, shorts, vestidos, capas, calzado y gorros. No hay bolsos ni ropa de baño.

**Fondo blanco:** se aplica como en la app (`enhancePhoto`). 281 de las 372 fotos (76 %) quedan con fondo blanco.

**Etiquetas** (`atelier/benchmarks/real-photos/labels.json`):
- La categoría sale de la carpeta.
- El color lo estima el móvil (`guessColor`), así que puede fallar: por ejemplo, un fucsia sale como «Rojo».
- **Hechas a mano por Claude, mirando cada foto:**
  - **Calzado:** deportivas, sandalias, botas, mocasines, bailarinas, zuecos y zapatillas de casa.
  - **Capas:** abrigo, chaqueta, chaleco o cárdigan, y cuánto abriga cada una.
  - **Gorros:** gorra, gorro de lana, boina o sombrero.
  - **Vestidos:** el estampado.
- **Asignadas por regla:** la temporada y el estilo del resto. Son aproximados.

**Armarios** (`wardrobes.json`):
- A, B y C: 44 prendas cada uno (14 de arriba, 9 de abajo, 4 vestidos, 6 capas, 9 calzados y 2 gorros), al azar con semilla fija.
- «Todo»: las 372 prendas.

**Escenarios:**
- 8 °C (enero): diario y trabajo.
- 17 °C (abril): diario, trabajo y fiesta.
- 28 °C (julio): diario, trabajo, fiesta y playa.
- `rankOutfits({max:3, date, temp, occasion})`, con 3 propuestas por escenario.

**Resultado:** 100 looks revisados uno a uno en capturas a escala real.

**Para repetirlo:** `node atelier/benchmarks/real-photos/eval.mjs <clothing-dataset-small>/test <salida>`, con el servidor local en marcha. Genera capturas por armario, `report.json` y los recuentos de abajo.

## Lo que funciona

- **Ningún look sin base:** todos llevan arriba y abajo, o vestido.
- No aparecen zapatillas de casa fuera de casa.
- No hay chanclas con frío ni gorro de lana con chanclas (#93).
- **Capas según el tiempo:** abrigo a 8 °C, chaqueta ligera a 17 °C y ninguna a 28 °C.
- En la playa, vestido con sandalias.
- Las prendas protagonistas con fondo blanco se ven bien en los recuadros.

## Problemas (por gravedad)

| # | Patrón | Recuento (100 looks) | Ejemplo reproducible |
| --- | --- | --- | --- |
| P1 | **Trabajo = diario**: las 3 propuestas de «trabajo» son idénticas a las de «diario» | **36 de 36** | Armario A, 8 °C: Jersey azul · Falda azul · Deportivas negro · Chaleco azul · Boina negro, en los dos |
| P2 | **Todo del mismo color**: 3 o más piezas del mismo color vivo, incluidos calzado y gorra | **29** | Todo, 8 °C: Jersey rojo · Pantalón «rojo» (fucsia) · Abrigo rojo · Gorra rosa. Todo, 17 °C: Vestido verde · Zuecos verdes · Chaqueta verde |
| P3 | **Gorro o gorra casi siempre**: el motor añade un gorro en cuanto hay uno compatible | **57** | A, 28 °C: vestido de verano + sandalias + **boina negra**. Todo, 8 °C: abrigo rojo + **gorra rosa infantil** |
| P4 | **Gorra o gorro en trabajo o fiesta** | **14 de 52** | Todo, trabajo 28 °C: Vestido gris · Sandalias · **Gorra negra** |
| P5 | **Jersey a 24 °C o más** (también en la playa) | **7** | Todo, playa 28 °C: Jersey rojo · Pantalón · Sandalias · Gorra |
| P6 | **Gorro de lana a 15 °C o más** | **4** | A, 17 °C: Vestido estampado · Deportivas · Chaqueta · **Gorro de lana** |
| P7 | **Fiesta sin calzado** cuando no hay zapatos de fiesta | **8** | A y B, fiesta: Camisa · Pantalón (solo 2 propuestas, sin zapatos) |
| P8 | **Zuecos o shorts en el trabajo** | 9 | B, trabajo 17 °C: Jersey · **Shorts** · **Zuecos** · Chaqueta · Gorro |
| P9 | **Solo chaleco a menos de 12 °C**, sin abrigo | 2 | A, 8 °C: Jersey · Falda · Deportivas · **Chaleco** · Boina |

**Aviso de fiabilidad:**
- P2 y P5 dependen en parte de las etiquetas: el color estimado y «Jersey» con temporada «todo el año».
- P1, P3, P4 y P6 no dependen de esas dudas: se ven en las fotos y el motor los produce con cualquier etiqueta.
- Los armarios de prueba no tienen zapatos de fiesta ni bolsos, así que P7 y la ausencia de bolsos son en parte cosa de los datos.

## Propuestas para el motor (para ChatGPT)

1. **P1, trabajo:**
   - En trabajo, preferir el estilo `smart` y penalizar shorts, zuecos, chanclas, gorras y gorros.
   - Las deportivas valen solo si no hay otro calzado compatible.
   - Hay que conseguir que trabajo y diario no salgan siempre iguales.
2. **P2, color:**
   - El «tono sobre tono» puntúa bien entre **2 prendas principales**.
   - Calzado, capa y complementos deberían ser neutros o el único acento.
   - Penalizar 3 o más piezas del mismo color vivo.
3. **P3 y P4, complementos:**
   - Un gorro o una gorra solo si suman de verdad: el umbral actual `pref(c[0])<1` es demasiado bajo.
   - Nunca en trabajo ni en fiesta.
   - A 24 °C o más, solo sombrero o gorra.
   - Como mucho uno por look.
4. **P5 y P6, tiempo:**
   - Jerséis y prendas `thickness: grueso` fuera a 24 °C o más.
   - Gorro de lana solo por debajo de unos 12 °C. Hoy #93 lo permite hasta 19 °C.
5. **P9:** a menos de 12 °C, un chaleco no basta como capa. Hace falta `warmth: alto`, o chaleco más otra capa.

Cada cambio debe llevar su prueba de regresión con estos mismos casos. Después de cada cambio, este informe se repite con `eval.mjs` sobre los mismos armarios y escenarios.

## Tras P1, P3, P4, P6 y P8 (Claude, `claude/motor-p1-p8`) · mismos armarios y escenarios

| Patrón | Antes | Después |
| --- | --- | --- |
| Trabajo idéntico a diario | 36 de 36 | **9** |
| Con gorra, gorro, boina o sombrero | 57 | **13** |
| Gorra o gorro en trabajo o fiesta | 14 | **0** |
| Gorro de lana a 15 °C o más | 4 | **0** |
| Zuecos o shorts en el trabajo (aviso «informal para trabajo») | 9 | **0** |
| 3 o más piezas del mismo color vivo (P2, pendiente) | 29 | 26 |
| Jersey a 24 °C o más (P5, pendiente) | 7 | 12 |
| Playa con jersey o capa | 3 | 5 |
| Fiesta sin calzado (P7, pendiente) | 8 | 8 |

**Cambios en el motor:**
- **Trabajo, formal y eventos:** ya no admiten shorts, chanclas, sandalias, zuecos, gorras, gorros, chándal ni mallas (`WORK_NO`).
- **Trabajo:** puntúa mejor las prendas `smart`. Ahora salen camisas, mocasines y bailarinas.
- **Gorros y sombreros:** solo en diario o playa, con motivo. El gorro de lana, por debajo de 12 °C; la gorra o el sombrero, a partir de 24 °C. El resto de complementos necesita sumar más que antes (umbral de 1 a 1,2).

**Efecto en P5:** sube de 7 a 12. Al quitar los gorros cambian las combinaciones elegidas, y aparecen más jerséis etiquetados como «todo el año» a 28 °C. Queda pendiente para P5.

## Estado en `main` v81 (tras #100, #102 y #103) · mismos armarios y escenarios

| Patrón | Inicio | v81 |
| --- | --- | --- |
| Trabajo idéntico a diario | 36 de 36 | 8 |
| Con gorra, gorro, boina o sombrero | 57 | 13 (solo con frío o calor de verdad, en diario o playa) |
| Gorra o gorro en trabajo o fiesta | 14 | 0 |
| 3 o más piezas del mismo color vivo | 29 | 3 |
| Jersey a 24 °C o más | 7 | 0 |
| Gorro de lana a 15 °C o más | 4 | 0 |
| Playa con jersey o capa | 3 | 0 |
| Prendas informales en el trabajo | 9 | 0 |
| Fiesta sin calzado | 8 | 4 |

**Pendiente (menor):** los 4 looks de fiesta sin calzado son a 28 °C en los armarios A y B. Solo tienen sandalias planas, deportivas y botines, y los botines son de invierno. Es un límite de los datos. Una opción: en fiesta y con calor, aceptar sandalias como último recurso.

## Segundo banco: ropa de mujer de catálogo (Polyvore) · `main` v82

**Por qué un segundo banco:** el primero no tiene bolsos, tacones, joyas ni ropa de fiesta.

**Datos:**
- 86 prendas de `Marqo/polyvore`: 20 de arriba, 14 de abajo, 10 vestidos, 10 capas, 14 calzados, 8 bolsos y 10 complementos.
- Fotos de producto, casi todas con fondo blanco. Las fotos no están en el repositorio: `labels-polyvore.json` guarda el `item_ID` de cada prenda.
- **Categoría y tipo:** salen de la categoría de Polyvore.
- **Color:** del texto de la prenda o estimado en el móvil.
- **Revisadas a mano:** 14 etiquetas, mirando cada foto.
- **Armarios:** «P» con las 86 prendas y «P-mitad» con 46.

**Para repetirlo:**
1. Descargar las fotos por `item_ID` desde `datasets-server.huggingface.co` a `img/` (ver `source` en `labels-polyvore.json`).
2. `node atelier/benchmarks/real-photos/eval.mjs <carpeta> <salida> labels-polyvore.json wardrobes-polyvore.json`.

**Bien:**
- **Fiesta:** siempre vestido corto o largo con tacones, bolso de fiesta y blazer a 17 °C. Ni deportivas ni tacones en la playa.
- El bolso de fiesta solo aparece en fiesta.
- Un solo complemento por look, con sentido (pendientes, reloj o gafas de sol).

**Problemas nuevos:**

| # | Patrón | Recuento | Ejemplo |
| --- | --- | --- | --- |
| Q1 | **Casi todo son vestidos**: con 20 partes de arriba y 14 de abajo, 50 de 54 looks llevan vestido. En diario, trabajo y playa de «P», el 100 %. En el primer banco, 47 de 100 | 50 de 54 | P, trabajo, 8 °C: vestido dorado metalizado + deportivas Vans + abrigo rosa |
| Q2 | **Vestido + deportivas en trabajo**, a 8 y 17 °C | 9 | P, trabajo, 17 °C: los tres looks |
| Q3 | **Mochila de montaña** (North Face) con vestido, en trabajo y playa | 3 en trabajo o fiesta, 3 en playa | P, playa, 28 °C: vestido + sandalias + mochila |

**Causa probable de Q1, en `scoreOutfit`:**
- **Silueta:** con un vestido vale 0,8. Con arriba + abajo sin `fit` conocido vale 0,65, es decir, 3,75 puntos menos. El banco no tiene `fit`; en la app lo rellena el análisis, pero muchas prendas quedarán sin él.
- **Color:** es la media de las parejas de prendas. Un look con vestido tiene menos parejas y suele salir más alto.

**Propuestas (motor, ChatGPT):**
- **Q1:** igualar la silueta cuando no se conoce el corte (0,75 en los dos casos). Además, si hay prendas de arriba y de abajo, como mucho 1 vestido entre las 3 propuestas, o en proporción al armario.
- **Q2:** en trabajo, con vestido, preferir bailarinas, mocasines o botines a las deportivas.
- **Q3:** mochila solo en diario o deporte, y nunca con prendas `smart` ni `party`.
