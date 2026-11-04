import { Router } from 'express';
import { isNeonConfigured } from '../config/prisma';
import { analysisController } from '../controllers/analysis.controller';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { analysisRateLimitMiddleware } from '../middlewares/rate-limit.middleware';

const router = Router();

// Healthcheck (GET /api/v1/health)
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    db: isNeonConfigured() ? 'neon-postgresql' : 'local-persistent-store',
    timestamp: new Date().toISOString(),
  });
});

// Rotas Públicas de Autenticação (RF-001)
router.post('/auth/register', (req, res, next) => authController.register(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));

// Rotas Protegidas (Exigem JWT - RF-001)
router.get('/auth/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

// Rotas de Análise de Foto, Regeneração e Histórico (RF-002 a RF-008)
router.post('/analyses', authMiddleware, analysisRateLimitMiddleware, (req, res, next) =>
  analysisController.create(req, res, next)
);
router.post(
  '/analyses/:id/regenerate',
  authMiddleware,
  analysisRateLimitMiddleware,
  (req, res, next) => analysisController.regenerate(req, res, next)
);
router.get('/analyses', authMiddleware, (req, res, next) =>
  analysisController.list(req, res, next)
);
router.delete('/analyses/:id', authMiddleware, (req, res, next) =>
  analysisController.remove(req, res, next)
);

export default router;
