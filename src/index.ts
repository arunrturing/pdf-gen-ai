/**
 * Main entry point for the library
 */

import { Configuration, DataModel, Result } from '@types';
import { ExampleService } from '@modules';
import * as helpers from '@utils';

// Export public API
export { Configuration, DataModel, Result, ExampleService };
export { createSuccessResult, createErrorResult } from '@utils';

/**
 * Creates a new instance of the ExampleService with default configuration
 * @param config Optional partial configuration
 * @returns An instance of ExampleService
 */
export function createService(config?: Partial<Configuration>): ExampleService {
    const defaultConfig: Configuration = {
    timeout: 1000,
    debug: false
    };
    
    return new ExampleService({
        ...defaultConfig,
        ...config
    });
}

// Export utility functions
export const utils = {
    ...helpers
};

// Default export
export default {
  createService,
  utils
};