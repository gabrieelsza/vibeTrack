import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { resetRateLimiter } from '../src/middlewares/rate-limit.middleware';
import {
  clearAiVisionCache,
  FALLBACK_VIBE_SUMMARY,
} from '../src/services/ai-vision.service';
import { clearAnalysisCache } from '../src/services/analysis.service';
import { clearMusicCatalogCache } from '../src/services/music-catalog.service';
import { resetLocalStore } from '../src/utils/local-store.util';
import {
  clearResilienceLogs,
  ConcurrencyQueue,
  getRecentResilienceLogs,
} from '../src/utils/resilience.util';

const REAL_GEMINI_API_KEY = env.GEMINI_API_KEY;

// Duas imagens PNG válidas com paletas/bytes diferentes
const SAMPLE_IMAGE_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SAMPLE_IMAGE_BLUE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

describe('VibeTrack API - Diagnóstico e Correção de IA Real vs Fallback Explícito (Partes 1 a 4)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = REAL_GEMINI_API_KEY;
    process.env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
    process.env.RATE_LIMIT_PER_MINUTE = '30';
    process.env.MAX_RETRIES = '1';
    process.env.RETRY_BASE_DELAY_MS = '50';
    process.env.SIMULATE_429_MODE = 'none';
    resetLocalStore();
    resetRateLimiter();
    clearAiVisionCache();
    clearAnalysisCache();
    clearMusicCatalogCache();
    clearResilienceLogs();
  });

  it('Parte 4.1 — Teste com chave inválida/ausente: deve retornar isFallback:true e fallbackReason NO_API_KEY com texto neutro', async () => {
    process.env.GEMINI_API_KEY = '';

    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Teste Sem Chave',
      email: 'nokey@vibetrack.app',
      password: 'password123',
    });
    const token = reg.body.token;

    const res = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
      });

    expect(res.status).toBe(201);
    expect(res.body.analysis.isFallback).toBe(true);
    expect(res.body.analysis.fallbackReason).toBe('NO_API_KEY');
    expect(res.body.analysis.vibeSummary).toBe(FALLBACK_VIBE_SUMMARY);
    for (const track of res.body.analysis.recommendations) {
      expect(track.reason).not.toContain('fotografia');
    }
  });

  it('Parte 4.2 — Teste com 429 simulado em dev: após os retries, deve retornar fallback com fallbackReason RATE_LIMITED', async () => {
    process.env.MAX_RETRIES = '1';

    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Teste Rate Limit',
      email: 'ratelimit429@vibetrack.app',
      password: 'password123',
    });
    const token = reg.body.token;

    const res = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .set('x-simulate-429', 'busy')
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
      });

    expect(res.status).toBe(201);
    expect(res.body.analysis.isFallback).toBe(true);
    expect(res.body.analysis.fallbackReason).toBe('RATE_LIMITED');
    expect(res.body.analysis.upstreamStatus).toBe(429);

    const logs = getRecentResilienceLogs();
    expect(logs.some((l) => l.outcome === 'RETRY_SCHEDULED' && l.service === 'AI_VISION')).toBe(
      true
    );
    expect(
      logs.some(
        (l) => l.outcome === 'FALLBACK' && l.fallbackReason === 'RATE_LIMITED'
      )
    ).toBe(true);
  }, 15000);

  it('Parte 4.3 — Teste com chave e modelo válidos (gemini-3.1-flash-lite) e duas fotos diferentes: isFallback:false e músicas diferentes', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Clara IA Real',
      email: 'clara.real@vibetrack.app',
      password: 'password123',
    });
    const token = reg.body.token;

    // Foto 1: Clima de Carnaval/Samba Tropical
    const res1 = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
        preferences: {
          genres: 'Samba de Raiz, Pagode Acústico',
          language: 'Português',
          era: 'Anos 80',
        },
      });

    expect(res1.status).toBe(201);
    expect(res1.body.analysis.isFallback).toBe(false);
    expect(res1.body.analysis.fallbackReason).toBeUndefined();
    expect(res1.body.analysis.vibeSummary).not.toBe(FALLBACK_VIBE_SUMMARY);

    // Foto 2: Clima de Heavy Metal / Rock Industrial Noturno
    const res2 = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_BLUE,
        preferences: {
          genres: 'Classical Piano, Baroque Instrumental',
          language: 'Instrumental',
          era: 'Clássico',
        },
      });

    expect(res2.status).toBe(201);
    expect(res2.body.analysis.isFallback).toBe(false);
    expect(res2.body.analysis.fallbackReason).toBeUndefined();
    expect(res2.body.analysis.vibeSummary).not.toBe(FALLBACK_VIBE_SUMMARY);

    const titles1 = res1.body.analysis.recommendations.map((r: { title: string }) =>
      r.title.toLowerCase()
    );
    const titles2 = res2.body.analysis.recommendations.map((r: { title: string }) =>
      r.title.toLowerCase()
    );

    // As duas listas de músicas geradas pela IA devem ser diferentes
    expect(titles1).not.toEqual(titles2);
  }, 35000);

  it('Parte 4.4 — Teste de cache: resultado de fallback NÃO pode envenenar o cache na chamada seguinte quando a API voltar', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Teste Cache Limpo',
      email: 'cacheclean@vibetrack.app',
      password: 'password123',
    });
    const token = reg.body.token;

    // 1ª chamada: API sem chave -> cai no fallback (isFallback: true)
    process.env.GEMINI_API_KEY = '';
    const fallbackRes = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
        preferences: { genres: 'Bossa Nova' },
      });

    expect(fallbackRes.status).toBe(201);
    expect(fallbackRes.body.analysis.isFallback).toBe(true);
    expect(fallbackRes.body.analysis.fallbackReason).toBe('NO_API_KEY');

    // 2ª chamada para a MESMA foto e MESMOS filtros após a chave voltar -> NÃO pode servir o fallback!
    process.env.GEMINI_API_KEY = REAL_GEMINI_API_KEY;
    const realRes = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
        preferences: { genres: 'Bossa Nova' },
      });

    expect(realRes.status).toBe(201);
    expect(realRes.body.cached).toBe(false);
    expect(realRes.body.analysis.isFallback).toBe(false);
    expect(realRes.body.analysis.vibeSummary).not.toBe(FALLBACK_VIBE_SUMMARY);

    // 3ª chamada idêntica: agora sim deve vir do cache da resposta REAL (cached: true, isFallback: false)
    const cachedRealRes = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: SAMPLE_IMAGE_RED,
        preferences: { genres: 'Bossa Nova' },
      });

    expect(cachedRealRes.status).toBe(201);
    expect(cachedRealRes.body.cached).toBe(true);
    expect(cachedRealRes.body.analysis.isFallback).toBe(false);
  }, 30000);

  it('RF-001, RF-002, RF-008 & Fila de Concorrência: Validações de entrada, histórico e limite de concorrência continuam íntegros', async () => {
    const unauthRes = await request(app).get('/api/v1/analyses');
    expect(unauthRes.status).toBe(401);

    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Pedro Completo',
      email: 'pedro@vibetrack.app',
      password: 'password123',
    });
    const token = reg.body.token;

    const invalidFormatRes = await request(app)
      .post('/api/v1/analyses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageBase64: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoK',
      });
    expect(invalidFormatRes.status).toBe(422);

    const queue = new ConcurrencyQueue('AI_VISION', () => 2);
    let currentActive = 0;
    let maxObservedActive = 0;
    await Promise.all(
      Array.from({ length: 5 }, () =>
        queue.run(async () => {
          currentActive++;
          maxObservedActive = Math.max(maxObservedActive, currentActive);
          await new Promise((r) => setTimeout(r, 20));
          currentActive--;
        })
      )
    );
    expect(maxObservedActive).toBeLessThanOrEqual(2);
  });
});
