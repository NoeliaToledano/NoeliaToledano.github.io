# Instrucciones para asistentes de código (ChatGPT/Codex, Claude y otros)

Este repositorio lo modifican varios asistentes. Antes de cambiar nada:

1. Trae lo último de `main` y lee el historial reciente (`git log -10`). Otro asistente puede haber cambiado los mismos archivos.
2. Edita solo lo necesario. **No reescribas archivos enteros** de Atelier: se pierden cambios que no conoces.
3. Antes de subir, ejecuta `node atelier/validate-v2.mjs`. Si falla, has borrado algo que debe estar.
4. Si cambias cualquier archivo de `atelier/`, sube la versión de `CACHE` en `atelier/sw.js` (por ejemplo `atelier-v2-shell-v9` → `-v10`) para que los móviles reciban la actualización.

## Atelier (`atelier/`): app web estática (PWA) para 3 perfiles familiares

Orden de carga en `index.html` (importa, cada archivo amplía al anterior):

| Archivo | Qué contiene |
| --- | --- |
| `app-v2.js` | Base: login, IndexedDB, prendas, looks, llamada a la API (`api()`) |
| `features-v3.js` | Armario avanzado, Estilista, Compras, Análisis, Calendario, copias de seguridad |
| `features-v4.js` | Redefine funciones de los anteriores (`saveState`, `loadState`, `readImage`, `lookCard`, `renderShopping`, `renderStylist`, `api`, `promptWear`…) |
| `styles-v2.css`, `styles-v4.css` | Estilos base y de v4 |

`features-v4.js` incluye:
- Fotos a 900 px guardadas por separado en IndexedDB (`img:<perfil>:<id>`); el estado principal no lleva fotos.
- Almacenamiento persistente, avisos de instalación y de copia de seguridad.
- Looks con collage de fotos.
- «¿Lo compro?» y «Te recomiendo comprar»: reglas locales de color, categoría, estilo y temporada, **sin IA**.
- «Combina una prenda»: looks alrededor de una prenda, **sin IA**.
- Tiempo de hoy con Open-Meteo (gratis); por defecto la temperatura es **25 °C**.
- Ahorro de tokens: el wrapper de `api()` envía IDs cortos (1, 2, 3…), máximo 24 prendas, sin campos vacíos; fotos a 512 px; caché de análisis; límites diarios por perfil (40 análisis, 20 sugerencias).

Reglas de la app:
- La sesión se guarda en `localStorage` (no en `sessionStorage`) y dura 30 días.
- La CSP de `index.html` solo permite conectar con el backend de Vercel y `api.open-meteo.com`.
- Prioridad: **gastar pocos tokens de OpenAI**. Lo que se pueda calcular en el móvil no debe ir a la IA.

## Backend (`atelier-api/`): funciones serverless en Vercel

- `/api/login`, `/api/session`: contraseñas scrypt y sesiones firmadas de 30 días.
- `/api/analyze`: analiza una foto con OpenAI (`detail: low`, salida máx. 220 tokens).
- `/api/looks`: crea looks con los IDs recibidos; tiene en cuenta `liked` y `disliked`; máximo 24 prendas.
- Mantén las instrucciones cortas: cada palabra del prompt se paga en cada llamada.
