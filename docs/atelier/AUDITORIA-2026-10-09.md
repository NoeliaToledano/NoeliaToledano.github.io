# Auditoría de Atelier · 9 de octubre de 2026

Versión auditada: `main` en `a54e11f` (navegación en cinco secciones y «Tu look de hoy»). Autor: Claude.

**Método:**
1. Revisión del código completo: app, backend y service worker.
2. Recorrido de todas las pantallas en un móvil de 390 px con un armario de 21 prendas de fotos reales, pasadas por el retoque de la app, más looks, planes, un viaje, deseos y usos.
3. Comprobación directa en el código de los hallazgos graves.

**Criterio:** perfección, elegancia, minimalismo y utilidad diaria, con gasto mínimo de IA.

**Solidez:** «verificado» significa comprobado en el código o en pantalla; «posible» queda pendiente de confirmar con uso real.

## 1. Veredicto

Atelier tiene **más funciones de las que su base soporta**.
- **Lo que funciona bien:** la idea (estilista con tu propia ropa), la privacidad (sin XSS, CSP estricta, fotos solo a 512 px a la IA) y el cálculo local sin tokens.
- **Lo que falla:**
  - **Fiabilidad:** la sincronización pisa preferencias, la IA no tiene límite real y el recorte de bases elimina los vestidos.
  - **Criterio de estilismo:** ignora la ocasión, añade chaqueta a 25 °C y repite siempre los mismos zapatos y la misma chaqueta.
  - **Acabado visual:** los looks se ven como mosaicos de fotos con fondos distintos, hay listas sin fotos donde los nombres se repiten, sobran elementos en cada tarjeta y hay textos cortados.

Hoy es una buena beta familiar, no una app «premium».

**Recomendación:** congelar funciones nuevas durante una fase de consolidación (secciones 5 y 6) antes del rediseño visual completo.

## 2. Lo que está bien (mantener)

- **Privacidad y seguridad del cliente:**
  - todo el texto de usuario se escapa;
  - las fotos se validan;
  - la CSP solo permite el backend y Open-Meteo;
  - los enlaces de la wishlist se filtran.
- **Gasto de IA contenido:**
  - IDs cortos;
  - 24 prendas como máximo;
  - fotos a 512 px con `detail: low`;
  - caché de análisis;
  - lo que se puede calcular en el móvil no va a la IA.
- **Funciones con valor real:** «Tu look de hoy», «Cambiar una prenda», Mi semana (planificado ≠ usado), Maletas con lista de imprescindibles y «Tus gustos».
- **Fotos:** el recorte es prudente (si duda, no recorta) y se puede elegir la versión.
- **Proceso:** validador, pruebas en Chrome y WebKit, y reglas de trabajo entre asistentes.

## 3. Experiencia y diseño (recorrido real)

| # | Gravedad | Dónde | Qué pasa | Propuesta |
| --- | --- | --- | --- | --- |
| D1 | Alta | Todos los looks | Solo se dibujan como composición limpia si **todas** las prendas tienen fondo blanco. Con fotos reales casi nunca ocurre, así que los looks salen como mosaicos de fotos con suelos y camas distintos. Es lo que más resta elegancia. | Composición por prenda: las de fondo blanco, recortadas; las demás, en miniatura recortada al centro sobre el mismo fondo. Nunca un collage de fondos mezclados. |
| D2 | Alta | Combinar prenda, Hoy, Mi semana | Los 3 looks propuestos llevan **los mismos zapatos y la misma chaqueta**: `completeLook` elige siempre el complemento con mejor puntuación. | Variar complementos entre propuestas: penalizar lo ya usado en las anteriores. |
| D3 | Alta | Hoy y propuestas | A 25 °C añade chaqueta (camiseta + shorts + chanclas + cazadora). La regla actual añade capa siempre que no sea de abrigo y haga menos de 27 °C. | Capa solo por debajo de unos 20 °C. Entre 20 y 24 °C, solo si es ligera y combina. Por encima, nunca. |
| D4 | Alta | Armario, Análisis, Rescata | Listas sin foto («Top vaquero» aparece 3 veces): con nombres parecidos no se sabe cuál es cuál. | Miniatura en todas las listas. Al guardar, si el nombre ya existe, añadir un detalle (color secundario, estampado). |
| D5 | Media | Tarjeta de prenda | Demasiado en poco espacio: ♡, «✓ Usada», «0 usos registrados · ✦ Olvidada». | Foto + nombre. Favorito y uso, en la ficha o con pulsación larga. |
| D6 | Media | Ficha de prenda al editar | Muestra «Sube una foto…», el paso «01» y «Analizar foto con IA» antes que la foto. La foto, que es lo importante, queda debajo. | Al editar: foto arriba, datos después; el análisis, solo si no se ha hecho. |
| D7 | Media | Varias tarjetas | Textos cortados: «Sin I» en la cabecera de Combinar, «Pantaló» en las etiquetas y botones partidos en dos líneas. | Etiquetas que pasen a la línea siguiente o con «…» y título completo. Un solo botón principal por tarjeta. |
| D8 | Media | Hoy | Todavía hay ruido: «Crear look manual», «Calendario de uso» y la lista de olvidadas debajo del look del día. | Hoy = look del día + mañana. Lo demás, en Estilista y Armario. |
| D9 | Media | Armario | Aviso de instalación y 4 cifras antes de la ropa. | Primero la ropa. Las cifras, en «Mi armario en cifras». El aviso, una sola vez. |
| D10 | Media | Análisis | «0,00 € valor registrado», barras sin fotos, 16 prendas «olvidadas» en un armario recién creado si la fecha de alta es antigua. | Ocultar métricas vacías y mostrar fotos. Contar «olvidada» solo tras 60 días con la app en uso. |
| D11 | Baja | Barra inferior | El icono ▣ de Maletas no se entiende; las etiquetas a 10 px en 320 px. | Iconos SVG coherentes (maleta, percha, varita) y 11–12 px. |
| D12 | Baja | Login | El botón vuelve a «Entrar» tras un error y pierde «a mi armario →». | Restaurar el texto. |

## 4. Estilismo y lógica

| # | Gravedad | Qué pasa (verificado) | Propuesta |
| --- | --- | --- | --- |
| E1 | Alta | `outfitBases` recorta a 400 **después** de añadir los vestidos. Con 20 prendas de arriba y 20 de abajo, los vestidos desaparecen de todas las propuestas. | Meter los vestidos primero y muestrear de forma equilibrada. |
| E2 | Alta | `dayProposals` (Hoy y Mi semana) **ignora la ocasión**. Con «Trabajo» puede salir ropa de deporte; con «Playa» excluye el baño y el calzado y propone ropa de calle descalza. | Filtrar por ocasiones de la prenda, estilo y formalidad. Incluir Baño en playa y Casa en casa. |
| E3 | Media | Dos definiciones de frío: `seasonFor` dice que octubre es «primavera/verano» (la maleta de Roma a final de octubre sale sin abrigo). Sin ubicación se usan 25 °C todo el año. | Una sola función de contexto, `tempFor(date)`: tiempo real, previsión o media del mes. Tres temporadas: cálida, media y fría. |
| E4 | Media | Las reglas de color (`GOOD_PAIRS`) y «dos estampados nunca» contradicen la especificación (§8.2): los complementarios se dan siempre por buenos. | Aplicar las reglas C03–C13 y E01–E04 del spec. |
| E5 | Media | Hay 5 funciones de puntuación y 4 formas de construir looks: resultados incoherentes entre pantallas. | Un único motor, `rankOutfits(context)`, con explicaciones (§9 del spec). |
| E6 | Media | La IA de looks recibe pijamas, bañadores y prendas fuera de temporada, y guarda 3 looks en «Mis looks» sin preguntar. | Filtrar antes de enviar y mostrar las propuestas antes de guardarlas. |
| E7 | Baja | Se puede registrar el mismo uso dos veces el mismo día; los looks de viaje usan la ocasión `travel`, que ya no existe. | Evitar duplicados; usar `daily`. |

## 5. Datos y sincronización

| # | Gravedad | Qué pasa (verificado) | Propuesta |
| --- | --- | --- | --- |
| S1 | Alta | `preferences` y `feedback` se fusionan con `{...remoto, ...local}`: gana el dispositivo que sincroniza, no el cambio más reciente. El look del día, «Me lo pongo», la ocasión y los 👍/👎 se pisan entre móviles; un 👎 quitado puede volver. | Guardar la fecha de cada clave y quedarse con la más reciente, con lápidas en `feedback`. |
| S2 | Alta | `normalizeData` descarta las claves que no conoce. Un móvil con una versión vieja borra `plans` (y cualquier dato futuro) del servidor. | Conservar las claves desconocidas, añadir `schemaVersion` y que el servidor rechace clientes antiguos. |
| S3 | Media | Si se edita algo durante la descarga de fotos, se descartan todas las descargadas y se repite (en un móvil nuevo, cientos de peticiones). Si una foto falla al subir, no se sube el resto de datos. | Guardar cada foto al llegar, descargar en paralelo y que un fallo de foto no bloquee los datos. |
| S4 | Media | Dos móviles sin conexión planifican el mismo día: quedan dos planes y uno no se puede quitar. | Id determinista por día (`plan:AAAA-MM-DD`). |
| S5 | Media | Restaurar una copia de seguridad no incluye `plans` y las prendas borradas después de la copia vuelven a borrarse al sincronizar. | Incluir `plans` y limpiar lápidas al restaurar. |
| S6 | Baja | Las lápidas caducan a los 90 días: un móvil que pase más tiempo sin conectarse resucita lo borrado. | Exigir sincronización completa si `lastSync` tiene más de 90 días. |

## 6. Coste de IA y seguridad del backend

| # | Gravedad | Qué pasa (verificado) | Propuesta |
| --- | --- | --- | --- |
| B1 | Alta | **No hay límite en el servidor** para `/api/analyze` y `/api/looks`. El límite diario solo existe en cada móvil (con 3 móviles, se triplica). Con un token válido (30 días) se puede gastar sin tope. Además, los textos del cuerpo entran en el prompt sin recortar. | Contador diario por perfil en Redis (`INCR` + `EXPIRE`) y validar o recortar todos los campos. |
| B2 | Media | El prompt de análisis ocupa unos 700 tokens y pide unos 20 campos, de los que el motor usa pocos. | Usar `json_schema` con enumerados y pedir solo lo que se usa: unos 300 tokens menos por foto. |
| B3 | Media | El límite de intentos de login está en memoria: en Vercel no frena la fuerza bruta. | Contador en Redis. |
| B4 | Media | Las sesiones no se pueden revocar y caducan a los 30 días aunque se use la app a diario. | Versión por perfil en el token y renovación al usar la app. |
| B5 | Media | «¿Lo compro?» llama a la IA automáticamente; Ajustes y `AGENTS.md` dicen que no la usa. | Analizar solo bajo demanda o corregir el texto. |
| B6 | Baja | Se devuelven al cliente los mensajes de error de OpenAI; la política de CORS no es coherente entre endpoints. | Mensajes genéricos y la misma lista de orígenes en todos. |

## 7. Rendimiento

| # | Gravedad | Qué pasa | Propuesta |
| --- | --- | --- | --- |
| R1 | Alta | Las fotos van dentro de los datos: cada cambio copia el estado completo con todas las fotos y cada pantalla vuelve a meter megas de imágenes en el HTML. Con 150 prendas, la app se volverá lenta (posible: con 21 prendas, Hoy tarda 33 ms; no medido con 150). | Fotos fuera del estado (URLs `blob:` en caché) y `<img>` en vez de imágenes incrustadas. |
| R2 | Media | El cálculo de looks recorre el historial de usos por cada comparación. | Precalcular usos y gustos una vez por pantalla. |
| R3 | Media | Retoque de fotos y «Mejorar todas» en el hilo principal: la app se congela. | Web Worker con `OffscreenCanvas`. |
| R4 | Media | Cada vuelta a la app descarga el estado completo; el deslizador de diversidad escribe en cada movimiento. | Consultar solo la versión antes de descargar y guardar al soltar. |

## 8. Accesibilidad y PWA

| # | Gravedad | Qué pasa | Propuesta |
| --- | --- | --- | --- |
| A1 | Media | Las fichas de prenda y de look no mueven el foco, no se cierran con Escape ni bloquean el fondo. | Un helper común de hojas (foco, Escape, `inert`, devolver el foco). |
| A2 | Media | El gris de texto secundario (#77716b) sobre marfil da 4,4:1 y sobre los chips 4,2:1. Hay textos a 2,99:1 y botones-chip de unos 30 px de alto. | `--muted:#6b655f` (≈ 5,2:1) y botones de al menos 44 px. |
| P1 | Media | `sw.js` copia la respuesta después de devolverla: a veces la caché no se actualiza (verificado en el código). | Copiar antes de devolver. |
| P2 | Media | `manifest.json` no tiene iconos: Android no la considera instalable, aunque la app pide instalarla. | Iconos de 192 y 512 px (incluido uno `maskable`) y `apple-touch-icon`. |
| P3 | Baja | No hay aviso de «nueva versión disponible». | Aviso discreto con «Actualizar». |

## 9. Plan propuesto

**Fase 1 · Fiabilidad**, sin cambios visuales:
- B1 (límite de IA en el servidor);
- S1 y S2 (sincronización y compatibilidad entre versiones);
- E1 (vestidos);
- P1 y P2 (service worker e iconos);
- S4 (plan por día) y S5 (restaurar copias).

**Fase 2 · Criterio de estilismo:**
- un motor único `rankOutfits` (E5) con ocasión (E2), temperatura única (E3), capas según el tiempo (D3), variedad de complementos (D2) y reglas de color y estampado del spec (E4);
- banco de pruebas de looks antes de publicarlo.

**Fase 3 · Acabado visual**, con el sistema visual de ChatGPT:
- composición de looks uniforme (D1);
- miniaturas en todas las listas (D4);
- tarjetas mínimas (D5);
- ficha de edición (D6);
- textos sin cortar (D7);
- Hoy y Armario limpios (D8 y D9);
- iconos (D11);
- accesibilidad (A1 y A2).

**Fase 4 · Rendimiento y coste:**
- fotos fuera del estado (R1);
- Worker (R3);
- sincronización ligera (R4);
- prompt de análisis reducido (B2).

**Reparto sugerido:**
- **Claude:** fases 1, 2 y 4.
- **ChatGPT/Codex:** fase 3 y los iconos y textos de la PWA.

Cada fase en PR pequeñas, con fusión automática según `AGENTS.md`.
