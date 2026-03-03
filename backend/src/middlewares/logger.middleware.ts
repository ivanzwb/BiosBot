import { Request, Response, NextFunction } from 'express';
import logger from '../infra/logger/logger';

export function loggerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  logger.info(`→ ${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
  });

  _res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`← ${req.method} ${req.path} ${_res.statusCode} (${duration}ms)`);
  });

  next();
}
