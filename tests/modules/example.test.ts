import { ExampleService } from '@modules/example';
import { DataModel, Configuration } from '@types/index';

describe('ExampleService', () => {
    let service: ExampleService;
    let testConfig: Configuration;
    let testData: DataModel;
    
    beforeEach(() => {
        // Setup test configuration
    testConfig = {
      timeout: 100,  // Short timeout for tests
      debug: false
        };
        
        // Create fresh instance for each test
    service = new ExampleService(testConfig);
        
        // Setup test data
    testData = {
      id: 'test-id-1',
      name: 'Test Data',
      created: new Date(),
      metadata: {
        source: 'test'
            }
        };
    });
    
    test('should correctly initialize with config', () => {
        expect(service.getConfig()).toEqual(testConfig);
    });
    
    test('should process data successfully', async () => {
        const result = await service.processData(testData);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        
        if (result.data) {
            expect(result.data.id).toBe(testData.id);
            expect(result.data.name).toBe(`Processed: ${testData.name}`);
            expect(result.data.metadata?.processedAt).toBeDefined();
        }
    });
    
    test('getConfig should return a copy of config', () => {
        const config = service.getConfig();
        
        // Modify the returned config
    config.debug = !config.debug;
        
        // Original config should remain unchanged
        expect(service.getConfig().debug).toBe(testConfig.debug);
    });
});