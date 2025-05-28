import { ErrorHandler } from '@types/index';

export const safeJsonParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    return fallback;
  }
};

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const debounce = <F extends (...args: any[]) => any>(
  func: F, 
  waitFor: number
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

export const createErrorHandler = (
  customHandler?: ErrorHandler
): ErrorHandler => {
  return (error: Error): void => {
    console.error(`Error occurred: ${error.message}`);
    
    if (customHandler) {
      customHandler(error);
    }
  };
};