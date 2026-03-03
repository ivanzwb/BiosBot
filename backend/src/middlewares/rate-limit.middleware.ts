import { Request, Response, NextFunction } from 'express';

/**
 * 基础速率限制 — 基于内存的简单实现，适用于单进程/单用户场景。
 * 时间窗口内超过 maxRequests 次请求则返回 429。
 */
const hitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(
  windowMs: number = 60_000,
  maxRequests: number = 120
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'local';
    const now = Date.now();
    let entry = hitMap.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hitMap.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later.',
      });
      return;
    }

    next();
  };
}
