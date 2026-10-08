# Atelier AI API

Backend serverless de Atelier para analizar prendas con OpenAI.

## Variable requerida
- OPENAI_API_KEY (secreto)
- OPENAI_VISION_MODEL (opcional; por defecto gpt-4o-mini)
- OPENAI_LOOK_MODEL (opcional; por defecto gpt-4o-mini)
- ATELIER_SESSION_SECRET (secreto para firmar sesiones; duran 30 días)
- ATELIER_PASSWORD_NOELIA, ATELIER_PASSWORD_ANA_MARIA, ATELIER_PASSWORD_IRENE (hash scrypt de cada contraseña)
- UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL y KV_REST_API_TOKEN): base de datos para sincronizar armario y fotos. Opcional: sin ellas la app funciona solo en local.

Endpoints:
- POST /api/login — { profileId, password } → { token, profileId, expiresIn }
- GET /api/session — comprueba el token (cabecera Authorization: Bearer)
- POST /api/analyze — { image: "data:image/jpeg;base64,..." } → { garment }
- POST /api/looks — { items, need, occasion, season, weather, avoid, liked, disliked } → { looks }
- GET /api/sync → { rev, data, images } · PUT /api/sync — { baseRev, data } → { rev } (409 si otro dispositivo guardó antes)
- GET /api/sync-image?id= → { image } · POST /api/sync-image — { id, image }

## Despliegues en Vercel
- `atelier-api/vercel.json` solo despliega el backend cuando hay cambios en `atelier-api` desde el último despliegue correcto (si no se puede comprobar, despliega).
- `vercel.json` en la raíz limita a `main` los despliegues del proyecto que publica todo el repositorio: las ramas de las PR ya no crean vistas previas.
- La cuenta gratuita permite 100 despliegues al día.

## Activar la sincronización
En Vercel, abre el proyecto del backend › Storage (o Marketplace) › crea una base de datos **Upstash Redis** (plan gratuito) y conéctala al proyecto. Vercel añade las variables automáticamente; después, vuelve a desplegar.
