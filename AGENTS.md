# Instrucciones para asistentes de código (ChatGPT/Codex, Claude y otros)

Este repositorio lo modifican varios asistentes. Para no pisarse:

1. **Trabaja en una rama y abre una PR.** No subas directamente a `main`: `main` es lo que está publicado.
   **Fusión automática** (decisión de Noelia): una PR se fusiona en cuanto se cumplen las cuatro condiciones:
   - la comprobación «Atelier checks» está en verde con el último commit (si la PR solo cambia documentación y no se ejecuta, basta con `node atelier/validate.mjs` en local);
   - no tiene conflictos con `main`;
   - no es borrador ni lleva «WIP» en el título;
   - su autor la da por terminada.
   La puede fusionar su autor o el otro asistente. Si un asistente encuentra un problema en la PR del otro, lo deja como comentario (o pide el cambio con `@codex`) en lugar de tocar su rama. Si tras dos rondas no hay acuerdo, decide Noelia.
   Cada fusión en `main` intenta desplegar Vercel (límite de 100 despliegues al día): agrupa los cambios pequeños en una sola PR cuando se pueda.
2. Antes de empezar, trae lo último de `main` y mira las PR abiertas. Si otra PR toca los mismos archivos, coordínalo antes de seguir.
3. Edita solo lo necesario. No reescribas archivos enteros sin decirlo en la PR.
4. Antes de abrir la PR, ejecuta `node atelier/validate.mjs`: comprueba la app **y la sintaxis del backend** (las pruebas de navegador simulan el backend y no detectan sus errores).
5. Si cambias algo de `atelier/`, sube en uno la versión de `CACHE` en `atelier/sw.js` (por ejemplo `atelier-shell-v29` → `-v30`; mira antes el valor actual) para que los móviles reciban la actualización.

## Atelier (`atelier/`): app web estática (PWA) para los perfiles de la familia (Noelia, Ana María, Irene, Eva y Virginia)

Todo el código está en **un solo archivo, `atelier.js`**, y los estilos en `atelier.css`. No se añaden archivos que redefinan funciones de otros (`x=function…`): se edita la función original. El validador lo comprueba.

Secciones de `atelier.js`:

| Sección | Qué contiene |
| --- | --- |
| 1. Configuración y utilidades | Constantes, ficha de características (`META_FIELDS`), utilidades |
| 2. Almacenamiento local | IndexedDB; fotos a 900 px guardadas aparte (`img:<perfil>:<id>`); foto original antes del fondo blanco solo en el dispositivo (`orig:<perfil>:<id>`) |
| 3. Sincronización | `/api/sync` y `/api/sync-image`; fusión de cambios entre dispositivos; borrados con `tomb(id)` |
| 4. API y ahorro de tokens | Todas las llamadas a ChatGPT pasan por `api()`: IDs cortos, 24 prendas máx., fotos a 512 px, caché, límites diarios |
| 5. Sesión y navegación | Login, sesión en `localStorage` (30 días), vistas |
| 6. Armario, prendas y looks | Ficha de prenda con foto de cámara o galería, mejora de fotos (`enhancePhoto`: fondo blanco y retoque, sin IA), análisis automático, looks como composición (`outfitBoard`), reglas locales de combinación |
| 7. Estilista | Pestañas Hoy / Mi semana / Combinar prenda / Mis looks / Maletas; «Cambiar prenda» (`swapOptions`); tiempo con Open-Meteo; 25 °C por defecto |
| 8. Compras | Pestañas ¿Lo compro? / Recomendaciones / Wishlist |
| 9–11 | Análisis, calendario, ajustes, copias y arranque |

Reglas de la app:
- Prioridad: **gastar pocos tokens de OpenAI**. Lo que se pueda calcular en el móvil no va a la IA («¿Lo compro?», recomendaciones, «Combinar prenda», maletas y el fondo blanco de las fotos no la usan).
- Al borrar una prenda, look, deseo o uso, llama a `tomb(id)`; si no, la sincronización lo resucita desde otro dispositivo.
- Al modificar una prenda o look, actualiza `updatedAt`: la sincronización se queda con la versión más reciente.
- Mi semana (`plans`): cada plan guarda su propia copia de prendas. Planificado no es usado: solo «Me lo he puesto» añade a `wearLog`.
- Sincronización: las preferencias y los 👍/👎 se fusionan **por clave** con las marcas de `stamps` (las pone `saveState`). Un `tomb` solo borra si es posterior al `updatedAt` del elemento. `normalizeData` conserva las claves que no conoce: no las elimines.
- El plan de un día tiene id fijo `plan:AAAA-MM-DD`. Los planes antiguos se migran solos (`onePlanPerDay`).
- Motor de estilismo (`rankOutfits`, `scoreOutfit`): los estilos se combinan por afinidad (`styleAffinity`); solo es imposible deporte con fiesta. «¿Cómo quieres vestirte hoy?» es `preferences.dressStyle` ∈ `elegante | arreglada | informal | deporte | comoda` o `null`.
- La CSP de `index.html` solo permite conectar con el backend de Vercel y `api.open-meteo.com`.

Pruebas: `atelier/security-test.mjs` (Node), `atelier/smoke-test.mjs` (Chrome) y `atelier/webkit-v3-test.mjs` (Safari/WebKit).

## Backend (`atelier-api/`): funciones serverless en Vercel

- `/api/login`, `/api/session`: contraseñas scrypt y sesiones firmadas de 30 días, renovadas por `/api/session` si tienen más de 7 y revocables por perfil con `ATELIER_SESSION_VERSION_<PERFIL>`. Los errores de la IA son genéricos (sin `detail`) y todas las funciones usan `cors()` de `_lib/store.js`. Para añadir un perfil, ver «Añadir un perfil nuevo» en `atelier-api/README.md`.
- `/api/analyze`: analiza una foto con OpenAI (`detail: low`).
- `/api/looks`: crea looks con los IDs recibidos; tiene en cuenta `liked` y `disliked`; máximo 24 prendas.
- `/api/analyze` y `/api/looks` tienen límite diario **por perfil en el servidor** (`dailyQuota` en Redis: 40 y 20, contado solo para peticiones válidas) y validan todo lo que entra en el prompt.
- `/api/login`: límite de intentos en Redis (5 por perfil e IP de Vercel y 20 por perfil en 5 min), compartido entre instancias.
- `/api/sync`, `/api/sync-image`: guardan el armario y las fotos en Upstash Redis. Sin las variables de Upstash devuelven 503 y la app sigue funcionando solo en local.
- Mantén las instrucciones a la IA cortas: cada palabra del prompt se paga en cada llamada.
