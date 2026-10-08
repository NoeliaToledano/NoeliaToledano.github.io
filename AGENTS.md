# Instrucciones para asistentes de código (ChatGPT/Codex, Claude y otros)

Este repositorio lo modifican varios asistentes. Para no pisarse:

1. **Trabaja en una rama y abre una PR.** No subas directamente a `main`: `main` es lo que está publicado. Noelia decide cuándo se fusiona.
2. Antes de empezar, trae lo último de `main` y mira las PR abiertas. Si otra PR toca los mismos archivos, coordínalo antes de seguir.
3. Edita solo lo necesario. No reescribas archivos enteros sin decirlo en la PR.
4. Antes de abrir la PR, ejecuta `node atelier/validate.mjs`: comprueba la app **y la sintaxis del backend** (las pruebas de navegador simulan el backend y no detectan sus errores).
5. Si cambias algo de `atelier/`, sube la versión de `CACHE` en `atelier/sw.js` (por ejemplo `atelier-shell-v15` → `-v16`) para que los móviles reciban la actualización.

## Atelier (`atelier/`): app web estática (PWA) para 3 perfiles familiares

Todo el código está en **un solo archivo, `atelier.js`**, y los estilos en `atelier.css`. No se añaden archivos que redefinan funciones de otros (`x=function…`): se edita la función original. El validador lo comprueba.

Secciones de `atelier.js`:

| Sección | Qué contiene |
| --- | --- |
| 1. Configuración y utilidades | Constantes, ficha de características (`META_FIELDS`), utilidades |
| 2. Almacenamiento local | IndexedDB; fotos a 900 px guardadas aparte (`img:<perfil>:<id>`) |
| 3. Sincronización | `/api/sync` y `/api/sync-image`; fusión de cambios entre dispositivos; borrados con `tomb(id)` |
| 4. API y ahorro de tokens | Todas las llamadas a ChatGPT pasan por `api()`: IDs cortos, 24 prendas máx., fotos a 512 px, caché, límites diarios |
| 5. Sesión y navegación | Login, sesión en `localStorage` (30 días), vistas |
| 6. Armario, prendas y looks | Ficha de prenda con foto de cámara o galería, análisis automático, reglas locales de combinación |
| 7. Estilista | Pestañas Hoy / Combinar prenda / Mis looks / Maletas; tiempo con Open-Meteo; 25 °C por defecto |
| 8. Compras | Pestañas ¿Lo compro? / Recomendaciones / Wishlist |
| 9–11 | Análisis, calendario, ajustes, copias y arranque |

Reglas de la app:
- Prioridad: **gastar pocos tokens de OpenAI**. Lo que se pueda calcular en el móvil no va a la IA («¿Lo compro?», recomendaciones, «Combinar prenda» y maletas no la usan).
- Al borrar una prenda, look, deseo o uso, llama a `tomb(id)`; si no, la sincronización lo resucita desde otro dispositivo.
- Al modificar una prenda o look, actualiza `updatedAt`: la sincronización se queda con la versión más reciente.
- La CSP de `index.html` solo permite conectar con el backend de Vercel y `api.open-meteo.com`.

Pruebas: `atelier/security-test.mjs` (Node), `atelier/smoke-test.mjs` (Chrome) y `atelier/webkit-v3-test.mjs` (Safari/WebKit).

## Backend (`atelier-api/`): funciones serverless en Vercel

- `/api/login`, `/api/session`: contraseñas scrypt y sesiones firmadas de 30 días.
- `/api/analyze`: analiza una foto con OpenAI (`detail: low`).
- `/api/looks`: crea looks con los IDs recibidos; tiene en cuenta `liked` y `disliked`; máximo 24 prendas.
- `/api/sync`, `/api/sync-image`: guardan el armario y las fotos en Upstash Redis. Sin las variables de Upstash devuelven 503 y la app sigue funcionando solo en local.
- Mantén las instrucciones a la IA cortas: cada palabra del prompt se paga en cada llamada.
