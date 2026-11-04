import { app } from './app';
import { env, getGeminiModel } from './config/env';
import { isNeonConfigured } from './config/prisma';
import { aiVisionService } from './services/ai-vision.service';

app.listen(env.PORT, () => {
  const dbMode = isNeonConfigured()
    ? 'Neon Serverless PostgreSQL (Prisma)'
    : 'Persistent Local Store (Configure DATABASE_URL no .env para Neon PostgreSQL)';
  console.log(`[VibeTrack API] Servidor rodando em http://localhost:${env.PORT}/api/v1`);
  console.log(`[VibeTrack DB] Modo de persistência ativo: ${dbMode}`);
  console.log(`[VibeTrack AI] Modelo configurado (GEMINI_MODEL): ${getGeminiModel()}`);

  void aiVisionService.validateModelOnStartup();
});
