import { Result } from '@types';

/**
 * Creates a successful result object
 * @param data The data to include in the result
 * @returns A Result object with success set to true
 */
export function createSuccessResult<T>(data: T): Result<T> {
    return {
    success: true,
    data,
    timestamp: Date.now()
    };
}

/**
 * Creates an error result object
 * @param error The error to include in the result
 * @returns A Result object with success set to false
 */
export function createErrorResult<T>(error: Error): Result<T> {
    return {
    success: false,
    error,
    timestamp: Date.now()
    };
}

/**
 * Safely parses a JSON string
 * @param input JSON string to parse
 * @returns Parsed object or null if parsing fails
 */
export function safeJsonParse(input: string): unknown {
    try {
        return JSON.parse(input);
    } catch (error) {
        return null;
    }
}

/**
 * Delays execution for the specified time
 * @param ms Milliseconds to delay
 * @returns A promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}