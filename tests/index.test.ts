import createLibrary from '../src';
import { DEFAULT_CONFIG } from '@constants/index';

describe('Library Entry Point', () => {
  describe('createLibrary', () => {
    it('should create a library instance with default config', () => {
      const library = createLibrary();
      
      expect(library.config).toEqual(DEFAULT_CONFIG);
      expect(library.userService).toBeDefined();
    });
    
    it('should override default config with provided values', () => {
      const customConfig = {
        apiKey: 'custom-key',
        timeout: 5000
      };
      
      const library = createLibrary(customConfig);
      
      expect(library.config).toEqual({
        ...DEFAULT_CONFIG,
        ...customConfig
      });
    });
    
    it('should initialize UserService with the correct config', () => {
      const customConfig = {
        apiKey: 'custom-key'
      };
      
      const library = createLibrary(customConfig);
      
      const userServiceConfig = (library.userService as any).config;
      expect(userServiceConfig.apiKey).toBe(customConfig.apiKey);
    });
  });
});