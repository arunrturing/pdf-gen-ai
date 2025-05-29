import { DataModel, Configuration, Result } from '@types';
import { createSuccessResult, createErrorResult } from '@utils';

/**
 * Example service class demonstrating module pattern and type usage
 */
export class ExampleService {
    private config: Configuration;

    constructor(config: Configuration) {
        this.config = config;
    }

    /**
   * Process data according to configuration
   * @param data The data to process
   * @returns Result with processed data or error
   */
    async processData(data: DataModel): Promise<Result<DataModel>> {
        try {
            if (this.config.debug) {
                console.log('Processing data:', data.id);
            }
            
            // Simulate processing
            await new Promise(resolve => setTimeout(resolve, this.config.timeout));
            
            // Modify the data in some way
            const processed: DataModel = {
                ...data,
        name: `Processed: ${data.name}`,
        metadata: {
                    ...data.metadata,
          processedAt: new Date().toISOString()
                }
            };
            
            return createSuccessResult(processed);
        } catch (error) {
            return createErrorResult<DataModel>(error instanceof Error ? error : new Error(String(error)));
        }
    }
    
    /**
   * Get the current configuration
   * @returns The current configuration
   */
    getConfig(): Configuration {
        return { ...this.config };
    }
}