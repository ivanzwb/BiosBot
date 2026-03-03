/**
 * intent.controller.ts — 意图识别控制器
 */

import { Request, Response, NextFunction } from 'express';
import { classifyIntent } from '../services/intent.service';
import { ClassifyRequest, ClassifyResponse } from '../types/api.types';

/**
 * POST /api/intent/classify
 */
export async function classify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query, conversationId } = req.body as ClassifyRequest;
    if (!query || !conversationId) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'query and conversationId are required' });
      return;
    }

    const result = await classifyIntent(query, conversationId);

    const response: ClassifyResponse = {
      intent: result.intent,
      domains: result.domains,
      confidence: result.confidence,
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}
