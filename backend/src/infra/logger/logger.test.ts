import winston from 'winston';
import logger from './logger';

describe('infra/logger/logger', () => {
  it('should be a Winston logger instance', () => {
    expect(logger).toBeInstanceOf(winston.Logger);
  });

  it('should have log methods', () => {
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.verbose).toBe('function');
  });

  it('should log without throwing', () => {
    expect(() => {
      logger.info('test info message');
      logger.debug('test debug message');
      logger.warn('test warning message');
      logger.error('test error message');
    }).not.toThrow();
  });
});
