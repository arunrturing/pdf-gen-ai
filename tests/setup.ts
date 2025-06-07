// Test setup configuration
import { jest } from '@jest/globals';

// Global setup for tests
global.console = {
    ...console,
    // You can silence some console output during tests
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};