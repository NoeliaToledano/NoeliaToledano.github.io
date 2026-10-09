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

## Historial
- 9 oct 2026 · línea base (antes de R1).
