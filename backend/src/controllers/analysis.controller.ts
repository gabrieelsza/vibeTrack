import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { isProductionEnv } from '../config/env';
import { analysisService } from '../services/analysis.service';

const createAnalysisSchema = z.object({
  imageBase64: z
    .string({ required_error: 'A imagem é obrigatória para realizar a análise.' })
    .min(1, 'Selecione uma imagem válida.'),
  imageThumbnail: z.string().optional(),
  bypassCache: z.boolean().optional(),
  preferences: z
    .object({
      genres: z.string().max(120).optional(),
      language: z.string().max(80).optional(),
      era: z.string().max(80).optional(),
    })
    .optional(),
});

function extractSimulateHeader(req: Request): string | undefined {
  if (isProductionEnv()) {
    return undefined;
  }
  const headerVal = req.headers['x-simulate-429'];
  if (typeof headerVal === 'string' && headerVal.trim()) {
    return headerVal.trim();
  }
  if (typeof req.query.simulate429 === 'string' && req.query.simulate429.trim()) {
    return req.query.simulate429.trim();
  }
  return undefined;
}

export class AnalysisController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const payload = createAnalysisSchema.parse(req.body);
      const simulate429Mode = extractSimulateHeader(req);
      const result = await analysisService.createAnalysis({
        userId,
        imageBase64: payload.imageBase64,
        imageThumbnail: payload.imageThumbnail,
        preferences: payload.preferences,
        simulate429Mode,
        bypassCache: payload.bypassCache,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async regenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const analysisId = String(req.params.id);
      const simulate429Mode = extractSimulateHeader(req);
      const result = await analysisService.regenerateAnalysis(
        userId,
        analysisId,
        simulate429Mode
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await analysisService.listUserAnalyses(userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const analysisId = String(req.params.id);
      const result = await analysisService.deleteUserAnalysis(userId, analysisId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const analysisController = new AnalysisController();
