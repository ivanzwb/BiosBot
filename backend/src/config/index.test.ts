import { config } from '../config/index';

describe('config', () => {
  it('should have port as a number', () => {
    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
  });

  it('should have nodeEnv as string', () => {
    expect(typeof config.nodeEnv).toBe('string');
  });

  it('should have logLevel as string', () => {
    expect(typeof config.logLevel).toBe('string');
  });

  it('should have sqliteDbPath as string', () => {
    expect(typeof config.sqliteDbPath).toBe('string');
  });

  it('should have agentDirs as array', () => {
    expect(Array.isArray(config.agentDirs)).toBe(true);
  });
});
