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
