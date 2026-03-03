import { Request, Response, NextFunction } from 'express';
import logger from '../infra/logger/logger';
import { ApiError } from '../types/api.types';

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  const body: ApiError = {
    code: 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
    detail: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  res.status(500).json(body);
}
