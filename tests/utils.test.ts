import { safeJsonParse, delay, debounce } from '@utils/index';

describe('Utility Functions', () => {
  describe('safeJsonParse', () => {
    it('should correctly parse valid JSON', () => {
      const jsonString = '{"name":"John","age":30}';
      const fallback = { name: '', age: 0 };
      
      const result = safeJsonParse(jsonString, fallback);
      
      expect(result).toEqual({ name: 'John', age: 30 });
    });
    
    it('should return fallback for invalid JSON', () => {
      const invalidJsonString = '{"name":"John",age:30}';
      const fallback = { name: '', age: 0 };
      
      const result = safeJsonParse(invalidJsonString, fallback);
      
      expect(result).toBe(fallback);
    });
  });
  
  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      const delayMs = 100;
      
      await delay(delayMs);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 5);
    });
  });
  
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});