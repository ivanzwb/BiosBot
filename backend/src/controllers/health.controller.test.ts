import { Request, Response, NextFunction } from 'express';
import { healthCheck } from '../controllers/health.controller';

describe('controllers/health.controller', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn(),
    };
  });

  it('should return ok status', () => {
    healthCheck(mockReq as Request, mockRes as Response);
    
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
      })
    );
  });

  it('should include timestamp', () => {
    healthCheck(mockReq as Request, mockRes as Response);
    
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });
});
