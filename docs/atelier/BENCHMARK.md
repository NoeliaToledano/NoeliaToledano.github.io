# Benchmark de Atelier (#45)

Script reproducible: `node atelier/bench.mjs [chromium|webkit] [20,100,300,500]`, con el servidor local de las pruebas (`python3 -m http.server 8000`).

**Cómo mide:**
- Usa un armario sintético determinista: 7 categorías, estilos, temporadas, fotos JPEG generadas de 900 px, ~n/5 looks y n usos.
- Guarda el armario en IndexedDB como la app y desactiva la sincronización.
- Da la mediana de 5 repeticiones.
- No usa IA ni datos ni fotos reales.

Tiempos en ms; tamaños en KB o MB.

## Línea base · 9 oct 2026 · `main` tras #56 · Chrome (escritorio, contenedor de pruebas)

| Prendas | Arranque | Hoy | Otro look | Armario | HTML Armario (KB) | Buscar | Ficha | Motor | Mis looks | HTML Mis looks (KB) | Guardar | Estado (KB) | Fotos (MB) | Memoria (MB) | Errores |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 225 | 6 | 11 | 92 | 1 877 | 2 | 2 | 2 | 46 | 2 120 | 45 | 8 | 1,8 | 51 | 0 |
| 100 | 494 | 11 | 80 | 160 | 8 895 | 8 | 1 | 45 | 266 | 10 657 | 198 | 35 | 8,6 | 68 | 0 |
| 300 | 744 | 28 | 302 | 518 | 26 678 | 31 | 1 | 224 | 310 | 31 878 | 507 | 104 | 25,9 | 86 | 0 |
| 500 | 1 332 | 71 | 626 | 807 | 44 462 | 42 | 1 | 449 | 598 | 53 203 | 797 | 173 | 43,2 | 281 | 0 |

**Lectura:**
- **R1, confirmado:**
  - El HTML de Armario y de Mis looks crece con las fotos incrustadas: unos 89 KB por prenda en Armario, y más en Mis looks porque cada foto se repite en la composición y en las miniaturas. Con 500 prendas son 44–53 MB por pintado.
  - «Guardar» (un favorito) tarda 0,8 s con 500 prendas, porque copia el estado con todas las fotos.
  - En un móvil serán varias veces más lentos (no medido aquí).
- **Motor:** 449 ms con 500 prendas, y «Otro look» 626 ms. Es aceptable, pero mejorable con un precálculo por pintado (R2).
- **Ficha y búsqueda:** rápidas en todos los tamaños.

**Pendiente:**
- WebKit: ejecutar con `webkit` en la CI o en un Mac (aquí no está instalado).
- Medidas en un móvil real.
- Sincronización (peticiones y bytes) con un backend simulado.

## Tras R1 · fotos con URL `blob:` y copias sin duplicar fotos · mismo entorno

| Prendas | Arranque | Hoy | Otro look | Armario | HTML Armario (KB) | Buscar | Ficha | Motor | Mis looks | HTML Mis looks (KB) | Guardar | Estado (KB) | Fotos (MB) | Memoria (MB) | Errores |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 209 | 5 | 13 | 3 | 14 | 1 | 1 | 1 | 4 | 8 | 20 | 8 | 1,8 | 27 | 0 |
| 100 | 281 | 11 | 77 | 11 | 58 | 2 | 1 | 44 | 20 | 36 | 82 | 35 | 8,6 | 53 | 0 |
| 300 | 524 | 26 | 299 | 31 | 169 | 6 | 1 | 216 | 57 | 107 | 175 | 104 | 25,9 | 164 | 0 |
| 500 | 948 | 71 | 646 | 58 | 281 | 11 | 1 | 424 | 102 | 177 | 273 | 173 | 43,2 | 95 | 0 |

**Con 500 prendas:**
- Armario: de 807 a **58 ms**, y su HTML de 44 MB a **281 KB**.
- Mis looks: de 598 a **102 ms**.
- Guardar: de 797 a **273 ms**.
- Arranque: de 1 332 a **948 ms**.
- Memoria: de 281 a **95 MB**.

**Siguientes:** «Otro look» y el motor (unos 0,4–0,6 s con 500 prendas) con un precálculo por pintado (R2), y el retoque de fotos en un Worker (R3).

## Tras R2 · motor con índice por categoría y búsqueda de calzado solo en las propuestas elegidas

| Prendas | Otro look | Motor |
| --- | --- | --- |
| 20 | 9 | 1 |
| 100 | 55 | 21 |
| 300 | 167 | 86 |
| 500 | **342** (antes 646) | **148** (antes 424) |

Las demás columnas no cambian (dentro del ruido de medida).

## Historial
- 9 oct 2026 · R2: `lookTraits` con prendas resueltas, índice por categoría y `completeOutfit` (con búsqueda de calzado alternativo) solo para las propuestas elegidas.
- 9 oct 2026 · R1: fotos con `photoUrl(g)` (URL `blob:`) y `copyData` sin duplicar fotos.
- 9 oct 2026 · línea base (antes de R1).
