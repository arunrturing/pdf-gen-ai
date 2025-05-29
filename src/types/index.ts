/**
 * Type definitions for the library
 */

/** Example interface for a data model */
export interface DataModel {
  id: string;
  name: string;
  created: Date;
  metadata?: Record<string, unknown>;
}

/** Example configuration type */
export type Configuration = {
  apiKey?: string;
  timeout: number;
  debug: boolean;
  options?: Record<string, unknown>;
};

/** Example result type */
export type Result<T> = {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: number;
};