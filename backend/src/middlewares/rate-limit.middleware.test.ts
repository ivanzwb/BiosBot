/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware } from './rate-limit.middleware';

describe('middlewares/rate-limit.middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should call next for first request', () => {
    const middleware = rateLimitMiddleware(60_000, 5);
    
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
  });

  it('should allow requests within limit', () => {
    const middleware = rateLimitMiddleware(60_000, 5);
    
    for (let i = 0; i < 4; i++) {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    }
    
    expect(mockNext).toHaveBeenCalledTimes(4);
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
  });

  it('should return 429 when limit exceeded', () => {
    const middleware = rateLimitMiddleware(60_000, 5);
    
    // First 5 requests should pass
    for (let i = 0; i < 5; i++) {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    }
    
    // 6th request should be rate limited
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    });
  });
});
