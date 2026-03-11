// Jest test setup
// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
