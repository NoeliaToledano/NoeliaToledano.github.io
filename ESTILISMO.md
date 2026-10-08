# Criterios de estilismo de Atelier (borrador para revisar)

Documento de trabajo para el futuro **motor de estilismo**. Recoge las reglas con su fuente, cómo se puntuaría un look y cómo se comprobará la calidad. Todavía no hay código: primero se revisa y se acuerda este texto. Lo mantienen Noelia y los asistentes (Claude y ChatGPT/Codex); cualquier cambio de reglas se hace aquí antes que en `atelier.js`.

## 1. Principios

1. **Motor propio en el móvil, la IA como segunda capa.** Las reglas filtran y puntúan las combinaciones sin gastar tokens. La IA solo afina, propone alternativas o explica cuando aporta algo, y recibe las prendas ya filtradas.
2. **Las reglas son pautas de estilismo, no ciencia exacta.** Cada una indica su fuente y su **solidez**:
   - **alta**: estudio empírico o consenso claro entre fuentes profesionales;
   - **media**: consejo profesional habitual;
   - **baja**: gusto o convención que muchas fuentes discuten.
   Las de solidez baja nunca son restricciones, solo matices de la puntuación.
   Equivale a separar **reglas fundamentadas** (alta), **criterios editoriales** (media) y **decisiones experimentales** (baja). Antes de programar, cada regla debe tener además sus excepciones, los estilos en los que aplica y cómo se comprueba en el banco de pruebas (§ 6).
3. **Los pesos son una hipótesis inicial** y se ajustarán con looks reales y con los «me gusta / no me gusta» de cada perfil.
4. **Toda recomendación se explica** con frases cortas que salen de las reglas aplicadas («el plateado es el protagonista; la americana negra da estructura»).
5. **No siempre lo más neutro.** Entre los looks válidos se ofrece al menos una alternativa con más color o contraste cuando la haya.
6. **Diversidad.** No se enseñan varios looks casi iguales: se buscan versiones distintas (más clásica, más moderna, más creativa, más cómoda).
7. **Gustos por perfil.** Se aprende de looks guardados, rechazados, usados y favoritos de cada persona, sin suponer que el gusto de una es el de toda la familia.

## 2. Datos de cada prenda que usa el motor

| Dato | Hoy | Propuesta |
| --- | --- | --- |
| Categoría y tipo | Sí (`category`, `type`) | Igual |
| Color principal | Texto libre (`color`) | Color con nombre de una paleta fija + su valor (claro/oscuro) |
| Colores secundarios | Uno, texto (`secondaryColor`), no se usa | Hasta 3 con porcentaje, **medidos solo en la prenda** cuando se ha podido quitar el fondo; si no, los da la IA |
| Estampado | Tipo (`pattern`) | Tipo + escala (pequeño / mediano / grande) |
| Corte y volumen | `fit`, `length` | Igual + volumen derivado (ajustado / regular / amplio) |
| Formalidad | `formality`, `style` | Escala numérica 1–5 (deporte 1 … formal 5) |
| Abrigo | `warmth`, `thickness`, `season` | Igual |
| Textura / brillo | `fabric` | + «brillante/metalizado» (satén, lentejuelas, plateado, dorado) |
| Protagonista | — | Se calcula: color saturado, metalizado o estampado grande |

Todo se puede corregir a mano: una foto no dice con certeza cómo sienta la prenda.

## 3. Reglas

Tipo: **R** = restricción (descarta el look); **P** = puntuación (suma o resta).

### 3.1 Color

| Id | Regla | Tipo | Solidez | Fuente |
| --- | --- | --- | --- | --- |
| C1 | Negro, blanco, gris, beige, camel/marrón, marino y oliva actúan como neutros: combinan con casi todo. | P+ | alta | [Outfit Narrative](https://outfitnarrative.com/menswear/simple-color-theory-for-casual-outfits) |
| C2 | El vaquero (denim) se trata como neutro. | P+ | media | [Lauren Conrad](https://laurenconrad.com/?p=38613), [MasterClass](https://www.masterclass.com/articles/how-to-mix-prints-and-patterns-to-create-a-stylish-outfit) |
| C3 | Tono sobre tono (misma familia, distinta luminosidad) es la combinación más armónica. | P+ | alta | [Schloss y Palmer 2011](https://palmerlab.berkeley.edu/pdf/Schloss&Palmer(2011).pdf) |
| C4 | Colores vecinos en la rueda (azul–verde, rojo–naranja) son armónicos. | P+ | alta | Schloss y Palmer 2011; Outfit Narrative |
| C5 | Complementarios (azul–naranja, rojo–verde) solo como acento: una prenda o un complemento, no dos prendas grandes. | P (+ si acento, − si dos piezas grandes) | alta | Schloss y Palmer 2011 (los complementarios puntúan *menos* armónicos); Outfit Narrative |
| C6 | Contraste de claridad entre prendas (claro con oscuro) gusta más que dos tonos de la misma claridad. | P+ | alta | Schloss y Palmer 2011 |
| C7 | Máximo 3 colores; los neutros cuentan a medias. Lo habitual: 1 dominante, 1 secundario y 1 acento (≈ 60/30/10). | P | media | [Stitch Fix](https://www.stitchfix.com/men/blog/ask-a-stylist/wear-navy-and-black-together/) (máx. 3), regla 60-30-10 extendida entre estilistas |
| C8 | Recoger un color: si una prenda lisa repite un color de un estampado, suma. | P+ | media | [MasterClass](https://www.masterclass.com/articles/how-to-mix-prints-and-patterns-to-create-a-stylish-outfit) |
| C9 | Marino con negro funciona si hay contraste (el marino se ve azul) y no hay más de 3 colores; dos oscuros casi iguales restan. | P | media | [Stitch Fix](https://www.stitchfix.com/men/blog/ask-a-stylist/wear-navy-and-black-together/), [Who What Wear](https://whowhatwear.com/black-and-navy-outfits) |
| C10 | «No mezclar negro y marrón / marino y negro» son normas antiguas: no se aplican como restricción. | — | baja | [FashionBeans](https://www.fashionbeans.com/article/outdated-style-rules-should-break/), [Wardrobe Oxygen](https://www.wardrobeoxygen.com/some-rules-are-meant-to-be-broken) |
| C11 | Metalizados (plateado, dorado): una pieza protagonista y el resto neutro. Mezclar oro y plata, solo en detalles pequeños. | P | media | [Lauren Conrad](https://laurenconrad.com/?p=38613) |
| C12 | Dos colores muy saturados de familias lejanas sin un neutro que los una restan. | P− | media | Schloss y Palmer 2011 (armonía sube con menos saturación); MasterClass (anclar con un neutro) |

### 3.2 Estampados

| Id | Regla | Tipo | Solidez | Fuente |
| --- | --- | --- | --- | --- |
| E1 | Máximo 2 estampados por look. | R | media | [MasterClass](https://www.masterclass.com/articles/how-to-mix-prints-and-patterns-to-create-a-stylish-outfit), [Stitch Fix](https://stitchfix.com/women/blog/?p=6836) |
| E2 | Dos estampados combinan si comparten un color **o** tienen distinta escala (uno pequeño, otro grande). Si no, resta. | P | media | MasterClass |
| E3 | Rayas finas, lunares pequeños o cuadros pequeños funcionan casi como neutros. | P+ | media | MasterClass |
| E4 | Con 2 estampados, una pieza lisa y neutra (americana, vaquero, zapatos) los ancla. | P+ | media | MasterClass |
| E5 | Un estampado protagonista arriba pide abajo liso, y al revés. | P+ | media | [Ashlee Jaine, regla de tercios](https://ashleejaine.substack.com/p/how-to-create-well-balanced-outfit) |

### 3.3 Proporciones y silueta

| Id | Regla | Tipo | Solidez | Fuente |
| --- | --- | --- | --- | --- |
| S1 | Equilibrar volumen: prenda amplia con prenda ajustada o recta (oversize + pitillo; falda con vuelo + top entallado). | P+ | media | [Eileen Fisher](https://www.eileenfisher.com/a-sustainable-life/journal/a-simple-wardrobe/three-easy-proportions.html), [Petite Dressing](https://blog.petitedressing.com/10-silhouette-tricks-stylists-use-to-balance-an-outfit/) |
| S2 | Regla de tercios: parte de arriba que termina en la cintura (o metida) con abajo largo, ≈ 1/3 – 2/3. | P+ | media | Eileen Fisher |
| S3 | Amplio con amplio vale si es intencionado (oversize + pantalón ancho) y se marca algo la cintura o el bajo no corta en la cadera. | P | baja | Eileen Fisher |
| S4 | Capa larga (abrigo, cárdigan largo) sobre base más corta crea línea vertical; enseñar algo (tobillo, manga corta) la equilibra. | P+ | media | Eileen Fisher |
| S5 | Un cinturón en la cintura define la silueta en vestidos y prendas amplias. | P+ | media | Ashlee Jaine |

### 3.4 Estilo y formalidad

| Id | Regla | Tipo | Solidez | Fuente |
| --- | --- | --- | --- | --- |
| F1 | Las prendas no deben separarse más de 2 niveles de formalidad (1–5). | R | media | Convención de estilismo; equivale a `STYLE_OK` actual |
| F2 | Mezclar un nivel de formalidad (americana con vaqueros; deportivas con falda) da un look actual: suma si es solo una pieza «de otro nivel». | P+ | media | Práctica habitual de estilistas; ejemplo de la falda plateada con deportivas |
| F3 | El calzado marca la formalidad final del look. | P | media | Ashlee Jaine (el calzado como punto de interés) |
| F4 | Ropa de deporte solo con deporte o casual. | R | alta | Sentido común; reglas actuales |

### 3.5 Ocasión y clima (restricciones previas)

| Id | Regla | Tipo | Solidez |
| --- | --- | --- | --- |
| O1 | La ocasión pedida descarta prendas marcadas para usos incompatibles (pijama fuera de «Estar en casa», bañador fuera de «Playa y piscina»). | R | alta |
| O2 | Con menos de 17 °C se añade una capa; con más de 26 °C se evitan prendas de abrigo alto. 25 °C por defecto. | R | alta |
| O3 | Temporada de la prenda compatible con la actual. | R | alta |

Las O no necesitan fuente externa: son reglas de la propia app.

## 4. Puntuación de un look

Primero las **restricciones** (R): si alguna falla, el look no se propone, por bien que combinen los colores.

Después la **puntuación** (0–100), pesos propuestos por ChatGPT como hipótesis inicial:

| Bloque | Peso | Reglas |
| --- | --- | --- |
| Armonía de colores y estampados | 25 % | C1–C12, E2–E5 |
| Proporciones y silueta | 25 % | S1–S5 |
| Coherencia de estilo | 20 % | F2, F3 |
| Ocasión y clima | 20 % | Cuánto encaja (no solo si cumple) |
| Preferencias personales | 10 % | Favoritas, «me gusta / no me gusta», prendas olvidadas |

Si falta un dato (por ejemplo, el corte), ese bloque cuenta como neutro y no penaliza.

## 5. Explicaciones

Cada regla que suma o resta lleva una frase corta. Se muestran las 2–3 de más peso:

- C3 → «Tono sobre tono: azules de distinta intensidad».
- C8 → «El rojo de la falda recoge el de la blusa de flores».
- S1 → «La camisa amplia equilibra el pantalón ajustado».
- F2 → «Las deportivas rebajan la formalidad de la americana».
- C11 → «El plateado es el protagonista; el resto, en neutros».

## 6. Banco de pruebas (antes de publicar el motor)

Un archivo de looks de ejemplo, cada uno con su valoración esperada y el motivo:

- **buenos**, **cuestionables** e **incompatibles**;
- estilos casual, formal, deportivo, atrevido y minimalista, con distintos volúmenes;
- casos que hoy se hacen mal (ver § 7).

El test comprueba que los buenos superan a los cuestionables y que los incompatibles se descartan. Ideal: que una estilista revise el banco, no solo otra IA.

Caso de referencia (propuesto por ChatGPT): falda plateada, deportivas negras, camisa blanca, camisa negra y americana negra. Esperado: la falda es protagonista (C11); con camisa blanca + deportivas es un look de día (F2); con camisa negra + americana, de noche, y la americana da estructura (S1).

## 7. Diferencias con las reglas actuales (`pairs`, `colorsMatch`)

| Hoy | Problema | Propuesta |
| --- | --- | --- |
| Dos estampados = nunca | Descarta mezclas válidas | E1–E4 |
| Complementarios (azul–naranja…) en `GOOD_PAIRS` como siempre buenos | El estudio los valora menos armónicos | C5: solo como acento |
| Solo color principal, por palabras | Ignora secundarios y claridad | C6, C8 y colores medidos |
| Todo es sí/no | No ordena por calidad ni explica | Puntuación + explicaciones |
| Sin proporciones | — | S1–S5 con `fit` y `length` |
| Vaquero, marino, oliva y metalizados no siempre neutros | Combinaciones perdidas | C1, C2, C11 |

## 8. Orden de trabajo propuesto

| Fase | Entregable | Coste recurrente |
| --- | --- | --- |
| 1 | Este manual: reglas con fuente, excepciones y forma de comprobarlas | Ninguno |
| 2 | Análisis ampliado: colores medidos solo en la prenda, escala del estampado, volumen, formalidad 1–5 | Bajo (llamadas de IA ya existentes) |
| 3 | Motor local de compatibilidad y puntuación con explicaciones, sustituyendo `pairs` y `colorsMatch` de `atelier/atelier.js`, y usado para elegir qué prendas se envían a la IA | Sin coste de API |
| 4 | Perfiles de estilo y banco de looks de prueba | Ninguno |
| 5 | Personalización por perfil | Sin coste de API |
| 6 | Opcional: modelos de compatibilidad visual (§ 9) | Según el modelo |

Peticiones que el motor debería poder atender: «tres looks para trabajar, cómodos pero elegantes», «¿con qué combina esta falda?», «sorpréndeme», «una alternativa más atrevida», «cambia los zapatos sin estropear el conjunto».

## 9. Investigación para una fase posterior (no se usa todavía)

Modelos que aprenden qué prendas van juntas a partir de looks completos:

- Vasileva et al. (2018), *Learning Type-Aware Embeddings for Fashion Compatibility*, ECCV: distingue prendas parecidas de prendas que se complementan.
- Sarkar et al. (2023), *OutfitTransformer*, WACV: puntúa looks completos y busca la prenda que falta.
- Una revisión de 2024 (ACM) sobre modelos de compatibilidad explicables, citada por ChatGPT; pendiente de localizar la referencia exacta.

Se entrenan con datos tipo Polyvore. Antes de usarlos habría que revisar disponibilidad, licencias, actualidad y sesgos. No se entrenaría un modelo grande: sería caro y difícil de validar sin el banco de pruebas.

## Fuentes

- Schloss, K. B. y Palmer, S. E. (2011). *Aesthetic response to color combinations: preference, harmony, and similarity.* Attention, Perception & Psychophysics. [PDF](https://palmerlab.berkeley.edu/pdf/Schloss&Palmer(2011).pdf)
- MasterClass: [How to mix prints and patterns](https://www.masterclass.com/articles/how-to-mix-prints-and-patterns-to-create-a-stylish-outfit)
- Stitch Fix: [Wear navy and black together](https://www.stitchfix.com/men/blog/ask-a-stylist/wear-navy-and-black-together/) · [How to mix prints and patterns](https://stitchfix.com/women/blog/?p=6836)
- Eileen Fisher: [Three easy proportions](https://www.eileenfisher.com/a-sustainable-life/journal/a-simple-wardrobe/three-easy-proportions.html)
- Ashlee Jaine: [Rule of thirds for outfits](https://ashleejaine.substack.com/p/how-to-create-well-balanced-outfit)
- Petite Dressing: [10 silhouette tricks](https://blog.petitedressing.com/10-silhouette-tricks-stylists-use-to-balance-an-outfit/)
- Outfit Narrative: [Simple color theory for casual outfits](https://outfitnarrative.com/menswear/simple-color-theory-for-casual-outfits)
- Lauren Conrad: [How to wear mixed metallics](https://laurenconrad.com/?p=38613)
- Who What Wear: [Black and navy outfits](https://whowhatwear.com/black-and-navy-outfits)
- FashionBeans: [Outdated style rules you should break](https://www.fashionbeans.com/article/outdated-style-rules-should-break/) · Wardrobe Oxygen: [Some rules are meant to be broken](https://www.wardrobeoxygen.com/some-rules-are-meant-to-be-broken)
