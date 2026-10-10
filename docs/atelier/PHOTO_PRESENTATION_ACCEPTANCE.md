# Atelier · contrato visual de fotografías (premium)

## Objetivo
La consistencia visual se logra **en la presentación**, nunca modificando de forma silenciosa las fotos originales ni sus colores. Antes de aplicar un filtro como `mix-blend-mode:multiply`, comprobarlo con prendas claras, negras, estampadas y fondos grises; puede alterar el color y ocultar texturas.

## Matriz visual a probar (antes/después)
- Foto de catálogo sobre blanco: prenda completa, sin deformación.
- Foto sobre fondo gris y maniquí: superficie neutra, sin sustituir ni recolorear la imagen.
- Foto doméstica (cama/habitación): miniatura fiel si no hay recorte fiable; no mostrar falsas transparencias.
- Fotos mixtas de 2, 3, 5 y 7 prendas, con vestido, partes superior/inferior, calzado, bolso y accesorios pequeños.
- Anchos de 320, 375, 390 y 430 px; Chrome y WebKit.

## Condiciones de aprobación
1. Ningún `img` de `look-mixed-board` debe usar `object-fit:cover` ni deformarse; mantener `contain`.
2. No introducir filtros de saturación, color ni mezclas globales para disimular fondos.
3. El vestido es protagonista frente al calzado cuando el look tiene dos piezas, sin perjudicar camisa + pantalón.
4. Bolsos y complementos son secundarios en collages densos, pero siguen siendo reconocibles.
5. No afirmar que el resultado es premium solo por CI en verde: se requieren comparativas reales y aprobación visual.

La auditoría de Claude con Polyvore está documentada en el hilo de la PR #190. Las fotografías externas no se suben al repositorio por sus condiciones de uso.
