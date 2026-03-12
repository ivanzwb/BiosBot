/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { loggerMiddleware } from './logger.middleware';

describe('middlewares/logger.middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      query: { foo: 'bar' },
    };
    mockRes = {
      statusCode: 200,
      on: jest.fn((event: string, callback: any) => {
        if (event === 'finish') {
          setTimeout(callback, 0);
        }
      }),
    };
    mockNext = jest.fn();
  });

  it('should call next', () => {
    loggerMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('should attach finish listener for response', () => {
    loggerMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
