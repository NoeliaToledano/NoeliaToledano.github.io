# Atelier AI API

Backend serverless de Atelier para analizar prendas con OpenAI.

## Variable requerida
- OPENAI_API_KEY (secreto)
- OPENAI_VISION_MODEL (opcional; por defecto gpt-4o-mini)
- OPENAI_LOOK_MODEL (opcional; por defecto gpt-4o-mini)
- ATELIER_SESSION_SECRET (secreto para firmar sesiones; duran 30 días)
- ATELIER_PASSWORD_NOELIA, ATELIER_PASSWORD_ANA_MARIA, ATELIER_PASSWORD_IRENE (hash scrypt de cada contraseña)

Endpoints:
- POST /api/login — { profileId, password } → { token, profileId, expiresIn }
- GET /api/session — comprueba el token (cabecera Authorization: Bearer)
- POST /api/analyze — { image: "data:image/jpeg;base64,..." } → { garment }
- POST /api/looks — { items, need, occasion, season, weather, avoid, liked, disliked } → { looks }
