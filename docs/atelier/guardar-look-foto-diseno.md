# Atelier · «Guardar el look que llevo» — contrato de diseño (v1)
**Responsabilidades:** Claude implementa detección, recortes, matching y persistencia. ChatGPT define la interfaz, comportamiento responsive, accesibilidad y aceptación visual. No implementar lógica duplicada en esta PR.

## Flujo propuesto
1. **Entrada.** Botón contextual «📸 Guardar el look que llevo», junto a Mis looks / Hoy. Abre selector cámara o galería, sin analizar todavía. Texto: «Puedes revisar todas las prendas antes de guardar».
2. **Vista previa.** Fotografía vertical con `object-fit: contain`, sin tapar la cara ni recortarla automáticamente. CTA «Analizar prendas · 1 análisis» + «Cambiar foto». Informar claramente antes de enviar foto a IA.
3. **Análisis.** Estado de progreso accesible (`role=status`, `aria-live=polite`), bloqueo del CTA mientras ejecuta, botón Cancelar. Si falla, ofrecer Reintentar o Volver sin perder foto.
4. **Revisión.** En móvil, arriba miniatura de foto real (sin miniaturas enormes); debajo una lista de tarjetas, una por prenda detectada. En escritorio, foto a la izquierda y tarjetas a la derecha. Mostrar contador «3 prendas detectadas · Revisa cada una».
5. **Cada tarjeta:** miniatura del recorte, tipo/color editables, indicador de confianza comprensible (p.ej., «Revisar categoría»), acciones excluyentes **«Ya está en mi armario»** (elegir coincidencia) / **«Guardar como nueva»** (foto provisional) / **«No incluir»**. Evitar seleccionar coincidencias automáticamente. Si la IA no encuentra la prenda, mostrar «No he encontrado coincidencias» y permitir crearla.
6. **Confirmación.** Resumen del look: nombre editable; chips con las prendas seleccionadas, portada con foto original. Casilla opcional «Registrar que me lo he puesto hoy» (desmarcada por defecto). CTA «Guardar look»; confirmación y opción «Ver en Mis looks».

## Reglas visuales
- Estilo Atelier: base marfil/crema, tarjetas blancas con borde tenue, tipografía editorial sólo en encabezados, controles legibles. No superponer botones sobre la fotografía.
- En 320–390 px: una columna, márgenes laterales de 16 px, botones de ancho completo en área de confirmación, acciones de prenda en filas que envuelven sin cortar texto.
- En >=768 px: grid de dos columnas (foto 40%; revisión 60%), con `max-width` contenido 1000px; la foto queda `position:sticky` sólo cuando la altura disponible lo permita.
- Imagen provisional: distintivo en texto **«Foto provisional»** junto al recorte; CTA «Cambiar foto» disponible después del guardado. No presentar recortes como fotografía de catálogo.
- Fotos sin detección: no forzar que todo es una prenda; permitir añadir manualmente o volver a fotografiar.
- Prendas ya guardadas: nunca duplicar silenciosamente. La pantalla debe dejar revisar la coincidencia.
- Fotos con personas: NO eliminar cara ni compartir automáticamente. Explicar **«La foto del look se sincronizará entre tus dispositivos»** con opción de no usar la foto como portada si la arquitectura lo admite. Si no lo admite, pedir confirmación antes de guardar. No afirmar que la foto queda sólo local si se sincroniza.

## Interacción y accesibilidad
- Indicador de pasos «Foto → Revisar prendas → Guardar look» (sin navegación que pierda datos).
- Titulares semánticos, foco al abrir/cerrar modal, escape para salir con confirmación si hay cambios, botones de al menos 44px, zoom de texto 200% sin desbordamientos.
- No mostrar porcentajes de confianza no calibrados; preferir «Revisar».
- Cuando se descarta una detección, ofrecer «Deshacer»; las detecciones no equivalen a prendas guardadas hasta la confirmación final.
- Prevenir doble clic en Guardar. Si hay guardado parcial/error de red, mostrar estado y permitir recuperación segura, sin duplicados.
- Si faltan Arriba+Abajo / Vestidos / Casa / Baño, bloquear **guardar como look completo** con explicación y acciones para añadir/reclasificar; nunca borrar prendas ya revisadas.

## Aceptación visual y funcional (datos de prueba)
- Probar fotos de una persona con 2, 4, 7 prendas, foto vertical y horizontal, objetos ocultos, variaciones de iluminación, detección fallida y coincidencia ambigua.
- Capturas 320, 390, 768 y 1280 px; probar teclado y Safari/WebKit.
- Verificar que ningún nombre de botón se corta, que todos los recortes mantienen `object-fit:contain`, que el resumen respeta prendas excluidas y que la foto real sólo se guarda tras confirmación.
- Separar el coste: un análisis de detección no debe llamar a la IA una vez por prenda para cargar tarjetas.
- Respetar `AGENTS.md`: cambios en rama, validador, y aumento de CACHE si se modifica `atelier/`.

## Contrato mínimo de integración (propuesta; acordar nombres con Claude)
La lógica entregará a la vista: `{ photoPreviewUrl, detections:[{tempId, category, color, cropUrl, needsReview, matchedCandidates: [{id,name,imageUrl}]}], selected: [...] }`. La vista emite acciones `useExisting(tempId,id)`, `createNew(tempId,editedMetadata)`, `exclude(tempId)`, `confirmLook({name,coverPhoto,registerWear})`. Los nombres son orientativos; priorizar el contrato existente si Claude ya implementó otro.
