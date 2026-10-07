# Atelier AI API

Backend serverless de Atelier para analizar prendas con OpenAI.

## Variable requerida
- OPENAI_API_KEY (secreto)
- OPENAI_VISION_MODEL (opcional; por defecto gpt-4.1-mini)

Endpoint: POST /api/analyze
Body: { "image": "data:image/jpeg;base64,..." }
