# ATELIER — Atlas de conocimiento para el cerebro estilista
**Versión:** investigación v1 · 10/10/2026 · **Estado:** propuesta, no implementación.  
**Propósito:** gramática de prendas, fibras, tejidos, color, estampados, proporción, clima, ocasión y evaluación global, aplicable a cualquier identidad o expresión de género.

## 0. Decisiones arquitectónicas

- Una coincidencia entre colores/estampados **nunca** implica compatibilidad automática de prendas ni aprobación de look.
- Separar tres niveles: **propiedades de la prenda** (hechos observables y estimaciones), **relaciones en contexto** (dinámicas), **calidad del conjunto completo** (composición, uso real, gusto, incertidumbre).
- Distinguir materiales/fibras (`cotton`, `viscose`), construcción (`woven`, `knit`), ligamento/estructura (`twill`, `satin weave`, `jersey`), acabado (`brushed`, `coated`, `washed`) y apariencia (`satin sheen`, `denim wash`, `floral pattern`).
- No presuponer género, cuerpo, talla, aptitud personal ni comodidad observando una sola foto. No calcular «prenda que favorece a determinada forma corporal» sin medidas/preferencias explícitas y consentimiento.
- Una preferencia estética no es una restricción funcional; el gusto y la creatividad pueden hacer viable una mezcla no convencional.
- No atribuir a material o color conductas universales: grosor, estructura, forro, mezcla de fibras y diseño alteran calor, transpirabilidad, caída y uso.
- Reutilizar `META_FIELDS`, `pairEvidence`, `contextualizePair`, `comboIdentity`, `lookIssues` y `scoreOutfit` existentes; **no crear árbitro paralelo ni migración masiva** antes de auditar el código actual.
- Priorizar cobertura, metadatos confiables y test humano independiente antes de IA/modelos pesados.

## 1. Taxonomía de prendas — rol / subtipo / detalles

Cada prenda tiene `category`, `type`, `subtype`, `layerRole`, `coverage`, `fit`, `construction` y opcionalmente varios roles. No mapear automáticamente «vestido» a mujer ni «traje» a hombre.

| Familia/rol | Subtipos importantes | Atributos discriminantes |
|---|---|---|
| Superior base | camiseta, top, tank/sin mangas, polo, body, camisa, blusa, corsé, chaleco como top, crop, túnica | manga, escote, largo, transparencia, estructura, entalle, aperturas |
| Superior térmico | jersey fino/grueso, cardigan, sudadera, hoodie, polar, chaleco tejido | peso, trama, volumen, calor, uso interior/exterior |
| Inferior pantalón | vaquero, sastre, chino, cargo, jogger, legging, pantalón técnico, palazzo, culotte, bermuda, short | tiro, pernera, largo, volumen, construcción, formalidad contextual |
| Inferior falda | lápiz, evasé, midi plisada, mini, maxi, pareo, denim, satinada | vuelo, longitud, abertura, cintura, textura y movimiento |
| Enteriza | vestido lencero, camisero, punto, cóctel, gala, mono, peto, jumpsuit, traje de una pieza | manga, falda/pernera, largo, formalidad, posibilidad de capas |
| Exterior ligero | sobrecamisa, blazer, chaqueta vaquera, biker, bomber, trench ligero, kimono | rigidez, hombro, solapa, abertura, largo, volumen |
| Exterior frío/lluvia | abrigo paño, parka, puffer, impermeable, gabardina, capa, chaleco acolchado | impermeabilidad real, aislamiento, viento, capucha, largo |
| Conjunto coordinado | traje, twinset, matching set, chándal, dos piezas | múltiples prendas asociadas, no asumir inseparabilidad |
| Calzado | deportivas lifestyle/técnicas, loafers, mocasines, bailarinas, derby, oxford, bota, botín, tacones, sandalias, alpargatas, zuecos | horma, altura tacón/suela, funcionalidad, resistencia agua, caminar |
| Bolso/equipaje | tote, shopper, clutch, bandolera, mochila, bolso estructurado, riñonera | volumen, formalidad, función, material, manos libres |
| Accesorios | cinturón, pañuelo, bufanda, corbata, joyas, gorra, sombrero, guantes, medias, calcetines, gafas | zona de foco, abrigo, función, escala, visibilidad |
| Íntima/deporte/baño | bañador, bikini, slip, sujetador, bralette, térmica, prenda compresiva, equipación deportiva | cobertura, actividad, compatibilidad funcional y contexto |
| Tradicional/cultural | prendas regionales o religiosas, atuendo ceremonial, indumentaria específica | etiqueta declarada, contexto cultural; evitar deducir normas o identidad |

**Reglas de rol:** un chaleco puede ser capa o top; una camisa oversize puede funcionar abierta como sobrecamisa; un vestido puede llevar pantalón intencionalmente; un blazer puede ser pieza central. No vetar estas composiciones por plantillas rígidas: usar una gramática de roles contextual.

## 2. Clasificación textil en cuatro ejes independientes

### 2.1 Origen/composición de fibras

- Naturales vegetales: algodón, lino, cáñamo, ramio.
- Naturales animales: lana y variantes, cachemir, alpaca, mohair, seda.
- Celulósicas regeneradas: viscosa/rayón, modal, lyocell.
- Sintéticas: poliéster, poliamida/nylon, acrílico, elastano, polipropileno.
- Mezclas: porcentaje declarado en etiqueta; **no** inferir porcentajes desde fotografías.

Las fibras no predicen por sí solas si la prenda es fresca: un lino muy grueso con forro puede abrigar más que otra pieza fina; poliéster no significa siempre deportiva; lana fina no significa siempre invierno.

### 2.2 Construcción

- Tejido plano: tafetán, sarga/twill, satén como ligamento, popelín, gabardina, denim, jacquard.
- Punto: jersey, canalé/rib, interlock, tricot, crochet, malla, fleece/polar.
- No tejido, fieltro, recubiertos, laminados, piel/cuero, ante y alternativas.
- `denim` suele ser sarga; **no** es sinónimo de pantalón ni de azul. `satin` puede indicar un ligamento o una apariencia de brillo; guardar ambos si se conocen.

### 2.3 Familias de tejidos/acabados — comportamientos posibles, no garantías

| Material/superficie | Señales estilísticas posibles | Riesgo de inferencia |
|---|---|---|
| Popelín/camisería | estructura relativamente nítida, líneas limpias | gramaje, mezcla y planchado cambian caída |
| Lino | textura visible, arruga, estética relajada o sastrera | no siempre informal ni fresco |
| Denim | sarga, estructura, lavado y desgaste variable | bordados/print/acid wash no son liso |
| Pana | canalé, profundidad, peso visual | anchura del canalé y gramaje importan |
| Tweed/bouclé | textura compleja, estructura | formalidad varía según corte |
| Punto fino | caída suave o ajustada | grosor real y fibra determinan abrigo |
| Punto grueso | volumen textural | puede aportar foco visual sin print |
| Satén/seda brillante | reflejo, caída posible | brillo y flexibilidad no son equivalentes |
| Terciopelo | luz direccional, profundidad | se evalúa ocasión sin veto diario |
| Tul/organza/encaje | transparencia, capas, textura | exige cobertura y contexto reales |
| Chifón/georgette | ligereza/movimiento | forro cambia transparencia |
| Cuero/efecto cuero | estructura o flexibilidad, brillo o mate | acabados cambian formalidad |
| Neopreno/scuba | volumen y cuerpo, formas nítidas | no suponer impermeabilidad útil |
| Nylon técnico | apariencia deportiva o minimalista | corte/contexto puede ser formal |
| Sequin/lentejuelas/metálico | brillo y punto focal | cobertura, acabado y hora del día no son veto |

### 2.4 Variables de comportamiento

`drape` (fluida/semiestructurada/rígida), `weight` (ligera/media/pesada), `thickness`, `stretch`, `sheerness`, `surfaceSheen`, `textureRelief`, `wrinkleTendency`, `windResistance`, `waterResistance` y `thermalConfidence`. Diferenciar **visible/inferido/declarado por usuario**.

## 3. Color: representación y armonía contextual

Datos ideales por prenda: uno o varios colores, papel de fondo/figura/acento, proporción aproximada por zonas visibles, luminosidad, croma/saturación, matiz, contraste local y estado de confianza; nunca inferir temperatura cromática *objetiva* desde una foto con iluminación no controlada.

Familias descriptivas: blanco/crema/marfil, negros/grises, beige/topo/camel/marrones, azul marino/índigo/celeste/cobalto, verde oliva/salvia/esmeralda, amarillo mostaza/limón, naranja/terracota/coral, rojo/granate/burdeos, rosa/fucsia, violeta/lila, metálicos oro/plata/bronce, multicolor. Conservar alias y valores medibles cuando disponibles.

**Relaciones a explorar**: monocromía tonal; análogos; complementarios; tríadas; contraste claro-oscuro; neutro + acento; tonos tierra; cálido-frío; contraste brillante/mate y color repartido. Ninguna es prueba de buen look. Neutros y colores intensos no tienen papeles fijos: el negro puede ser protagonista; el blanco puede competir por superficie y contraste.

**Interacciones importantes**: un rojo pequeño en calzado no equivale a pantalón rojo; un verde estampado sobre fondo azul no equivale a verde plano; reflejos del satén y iluminación de la foto alteran percepción. El color debe evaluarse junto con material, escala, área y contexto, no por suma de distancias cromáticas.

## 4. Estampados y superficies visibles

Familias: liso, rayas (anchura/orientación), cuadros (vichy, tartán, príncipe de Gales, pata de gallo), lunares, flores (micro/maxi), hojas/botánico, animal (leopardo, cebra, serpiente), paisley, abstracto, geométrico, camuflaje, tie-dye, degradado, logotipos, dibujos/ilustración, jacquard, bordado, patchwork, gráfico localizado, motivos múltiples.

**Atributos**: familia primaria/secundaria, escala, densidad, regularidad, contraste, paleta, posición, superficie afectada, dirección, brillo, relieve y confianza. Un print localizado en bolsillo no tiene el impacto de un motivo all-over. Un acid wash puede ser textura visual muy fuerte sin un motivo geométrico identificable.

**Denim — ejes separados**:
- Tejido: denim de algodón o mezclas, elástico/no elástico.
- Lavado: índigo limpio, raw, light/medium/dark, stonewash, acid/snow, degradado, bleached.
- Acabado: distressed, rotos, bigotes/whiskering, abrasión, coating, efecto metalizado.
- Motivo: floral, rayas, animal, camuflaje, gráfico, jacquard.
- Construcción/decoración: paneles bicolor, patchwork, parches, bordados, apliques.

**Ejemplos no equivalentes:** vaquero índigo liso + camisa floral; vaquero acid wash + la misma camisa; vaquero bordado con flores localizadas + rayas; vaquero animal print all-over + cuadros; denim-on-denim mismo lavado y distinto lavado. **Todas requieren juicio global**; ninguna familia es combinación buena por definición.

No establecer máximo universal de dos estampados ni vetar cuadros+rayas o animal+flores. El motor puede considerar equilibrio clásico y maximalismo dirigido como propuestas distintas, con gusto del perfil.

## 5. Cortes, siluetas, volúmenes y proporciones

- `fit`: ceñido, ajustado, recto, regular, relajado, oversize, estructurado, drapeado. No confundir tallaje con estilo.
- `silhouette`: recta, A, evasé, reloj de arena por construcción, trapecio, globo, cocoon, columna, boxy, peplum, asimétrica.
- `length`: crop/cintura/cadera/muslo/rodilla/midi/tobillo/suelo; largo específico para mangas y bajos; tiro de pantalón alto/medio/bajo.
- `volume`: hombro/pecho/cintura/cadera/pernera/puño; blusa con manga abullonada no equivale a top entallado de igual color.
- `verticalLines`: abertura, pliegues, costura, botones, rayas; continuidad o cortes horizontales.
- `shapeCompatibility`: si las piezas se superponen, se abultan, ocultan la estructura o crean una intención clara. Oversize+oversize puede ser excelente.
- `movement`: caída, vuelo, rigidez, largo práctico, apertura, caminar/sentarse.

Analizar solo proporciones **entre prendas** cuando no haya datos corporales. Evitar reglas normativas sobre cuerpos, altura, edad o «favorecedor» inferidas.

## 6. Capas y relaciones físicas

Distinguir `base`, `mid`, `outer` y `accessory` por uso real, no solo categoría. Validar cómo se solapan mangas, puños, cuello, cintura, solapa, largos, volumen y material: chaqueta corta + blusa larga puede ser intencional; jersey voluminoso bajo blazer ceñido puede limitar movilidad; cuello alto bajo escote abierto cambia composición.

**Abrigo/clima:** temperatura, sensación térmica, viento, lluvia, exposición y actividad. Usar estimaciones de aislamiento con incertidumbre. ISO 9920:2007 se refiere a características térmicas de conjuntos, influencia de movimiento y aire; no cubre todas las condiciones de lluvia/nieve o confort táctil. Nunca concluir calor exacto por fibra o imagen sin datos. Si falta abrigo útil, mostrar ausencia, no «look perfecto».

## 7. Estilos e intención, no etiquetas excluyentes

Vectores graduales de estética: clásico, minimalista, preppy, smart casual, sastrería, streetwear, deportivo/athleisure, workwear, utilitario, romántico, bohemio, rock, grunge, punk, vintage, retro, maximalista, avant-garde, formal, fiesta, glam, coastal, elegante informal. Una prenda puede participar en varias estéticas.

`formality` de prenda ≠ identidad/formalidad del conjunto. No inferir estereotipos por género o perfil. La estética puede emerger de contrastes: deportivas limpias con sastrería, satén con punto, chaqueta técnica con prendas elegantes.

## 8. Ocasión, temperatura, actividad y función

Ejes de contexto: día a día, trabajo (códigos distintos), entrevista, evento, fiesta, boda como invitada/invitado, viaje, casa, playa/piscina, deporte específico, ocio al aire libre, noche, clima; registrar `dressCode` específico si se conoce, además de actividad, distancia caminando, interior/exterior, temperatura/viento/lluvia, preferencia de abrigo y movilidad.

No equiparar «trabajo» con prohibir zapatillas o estampados: oficina creativa y evento formal tienen restricciones diferentes. Tampoco equiparar «fiesta» con tacones.

## 9. Calzado, bolsos y complementos

Calzado: forma de puntera, altura/plataforma, suela, perfil, material, brillo, estructura, volumen visual, desgaste, capacidad de caminar, clima y actividad. El mismo vestido con deportivas o tacones puede formar **dos identidades** de look distintas.

Bolsos: forma, proporción, estructura, correa, capacidad, brillo, uso; no añadir por defecto. Accesorios (cinturón, pañuelo, pendientes, gorro) solo si cumplen función o mejoran el conjunto de forma perceptible. Una capa de frío puede ser imprescindible pero estéticamente conflictiva: no ocultar ese hecho.

## 10. Datos, confianza y corrección

Por atributo: `value`, `source` (user/photoAI/rule), `confidence` (known/inferred/unknown), `updatedAt`; conservar decisiones del usuario. Si el análisis no ve la espalda no debe afirmar el estampado completo; si la foto está mal iluminada no asegurar temperatura del color; si no ve tacto/etiqueta no afirmar fibras ni impermeabilidad.

Separar ficha mínima que ya existe de campos avanzados optativos; no exigir 30 respuestas al subir una prenda. Enriquecimiento progresivo al mejorar recomendaciones, con preguntas **puntuales** cuando falta un dato decisivo.

## 11. Evaluación — arquitectura de decisión

1. **Intención y contexto**: ocasión, estilo buscado, clima, actividad, gustos, restricciones.
2. **Evidencia de prendas**: valores conocidos, inferencias, incertidumbre y roles posibles.
3. **Generación diversificada**: núcleos válidos (vestido/mono o arriba+abajo; excepciones creativas explícitas), modelos por estilo, no solo pares de colores.
4. **Restricciones duras verificables**: cobertura y abrigo cuando sean necesarios, disponibilidad y exclusiones reales de ocasión; no convertir convenciones o gustos en bloqueos.
5. **Relaciones en contexto**: color, tejido, estampado, corte, texturas, uso, proporciones, materiales, líneas y silueta; detectar incompatibilidades relevantes sin promedios que las oculten.
6. **Juicio global**: balance, punto focal, ritmo, intención, coherencia funcional, identidad del look y **eslabón débil**.
7. **Ampliación marginal**: añadir calzado/capa por necesidad; extras solo si realmente mejoran. Evaluar el conjunto final, no una versión distinta del conjunto mostrada.
8. **Diversidad y gusto**: alternativas con bases diferentes o variaciones de intención clara; no repetir cambios triviales ni optimizar diversidad a costa de calidad.
9. **Explicación honesta**: mostrar razones verificables, reconocer incertidumbre; abstenerse cuando ninguna propuesta sea defendible.
10. **Feedback contextual**: aceptar/rechazar con motivos y aprender por perfil; no confundir gusto temporal con veto universal.

### Preguntas que debe poder contestar el motor

- ¿Por qué estas prendas funcionan **juntas**, no solo en parejas?
- ¿Qué parte del look falla y con qué sustitución mínima mejora?
- ¿Cambiar la longitud o la rigidez de una prenda cambia la valoración?
- ¿El mismo par de estampados funciona en un bolso, pero no en un pantalón?
- ¿El denim liso cambia de papel visual si el lavado es ácido o lleva bordados?
- ¿La misma combinación deja de ser práctica con frío, lluvia o diez kilómetros a pie?
- ¿Una versión maximalista válida puede coexistir con otra minimalista sin sesgos?
- ¿Existen datos suficientes para recomendarla o hay que abstenerse?

## 12. Casos de prueba adversariales

| Caso | Variable aislada | Resultado esperado |
| --- | --- | --- |
| 01 | mismo color, distinta caída seda rígida/fluida | no asumir equivalencia |
| 02 | rayas+flores, intercambiar micro y maxi | recalcular composición |
| 03 | pantalón denim limpio/acid wash | variar peso visual |
| 04 | flores bordadas localizadas/all-over | cambiar área de foco |
| 05 | mismo top con jeans rectos/ultra-wide | revisar volúmenes |
| 06 | mismo vestido con sneakers/derby/tacones | distintas identidades |
| 07 | blazer ceñido sobre fino/grueso | compatibilidad física |
| 08 | satén + punto grueso en trabajo/fiesta | registro contextual |
| 09 | negro total con materiales mate/brillantes | no penalizar por ausencia de contraste cromático |
| 10 | tres estampados intencionales vs dos discordantes | no contar patrones |
| 11 | look bueno más bolso innecesario | rechazar extras si empeoran |
| 12 | chaqueta de invierno a 28°C | contexto térmico |
| 13 | ropa ligera a 8°C con capa inadecuada | advertir, no falsear confort |
| 14 | atuendo oversize+oversize estético | no veto de volumen |
| 15 | mismo look en trabajo informal y entrevista formal | ajustar código de vestir |
| 16 | foto incierta vs prenda corregida | respetar confianza |
| 17 | perfil masculino, femenino o mixto con mismas piezas | mismas posibilidades, sin filtrado por género |
| 18 | maxí floral + rayas con zapatos disonantes | evaluar global, no solo pareja |
| 19 | jean patchwork con prenda geométrica | construcción visual separada de estampado |
| 20 | dos lavados denim coincidentes o contrastantes | ambos posibles, ningún «double denim» prohibido |
| 21 | mochila técnica vs bolso estructurado en evento | función/contexto y estilo |
| 22 | abrigo necesario que no combina | aviso + buscar otra capa, no ocultar |
| 23 | outfit sin buen calzado disponible | parcial/aviso, nunca inventar pieza |
| 24 | look usado/rechazado en un perfil, apreciado en otro | aprendizaje aislado por perfil |

**Procedimiento**: conjunto de desarrollo + lote de test humano congelado, armarios coherentes y variados, imágenes de producto reales con permiso o pruebas privadas; A/B ciego con «A / B / ambos / ninguno / insuficiente» y motivo. Informar restricciones y estética **por separado**, desacuerdo entre evaluadores, robustez a metadatos, tiempos y memoria (10/100/500 prendas). Ninguna métrica de tests basados en reglas certifica calidad estética.

## 13. Prioridad técnica para implementar — evitar una ficha inmanejable

**P0** Inventario del modelo real y errores de etiquetas; preservar esquema y compatibilidad de sincronización.

**P1** Separar inequívocamente fibra, tejido/estructura, denim/lavado, print, acabado y corte; añadir solo los campos cuyo rendimiento de detección y utilidad se puedan validar.

**P2** Factores trazables en `pairEvidence` + `contextualizePair`; comprobar interacciones tejido-caída, volumen/capa y estampados sin prohibiciones.

**P3** `comboIdentity`: evaluar conjunto completo, detectar eslabones débiles y comparar contrafactuales (cambio de pieza, calzado, ocasión o clima).

**P4** Ensayo humano ciego, calibración de preferencias, rendimiento móvil/caché y experiencia minimalista sin encarecer llamadas OpenAI.

No tocar código del motor en paralelo a Claude; revisión cruzada y pruebas antes de fusionar cualquier implementación.

## 14. Fuentes seleccionadas y alcance

- Utah State University Extension, *Design Principles for Clothing and Textiles*: https://extension.usu.edu/research/principles-of-design — balance, proporción, énfasis, ritmo y armonía; el juicio estético conserva subjetividad.
- ISO 9920:2007 (confirmada en 2026), *Estimation of thermal insulation and water vapour resistance of a clothing ensemble*: https://www.iso.org/standard/39257.html — estimación térmica para conjuntos, con límites explícitos.
- Investigación de Atelier disponible en PR pendientes de fusión: [PR #136](https://github.com/NoeliaToledano/NoeliaToledano.github.io/pull/136) y [PR #219](https://github.com/NoeliaToledano/NoeliaToledano.github.io/pull/219). Los documentos están en las ramas respectivas, no todavía en `main`.
- Levi's, *Denim Dictionary*: https://www.levi.com/ES/es_ES/features/denim-dictionary — vocabulario de acabados/lavados.
- Fashion Institute of Technology, *Elements and Principles of Fashion Design*: https://www.fitnyc.edu/museum/documents/elements-and-principles-of-fashion-design.pdf — referencia general de principios de diseño.

**Limitación epistemológica:** fuentes profesionales fundamentan principios y categorías; **no** prueban una regla algorítmica particular ni sustituyen evaluación humana. Materiales, estilos, cortes y etiquetas tienen variaciones culturales y comerciales. El atlas es un mapa extensible de atributos/casos, no una enumeración exhaustiva de todas las prendas existentes.
