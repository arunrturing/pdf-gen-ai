export type Nullable<T> = T | null;

export interface Config {
  apiKey: string;
  timeout: number;
  baseUrl: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

export type Handler<T, R> = (data: T) => Promise<R>;
export type ErrorHandler = (error: Error) => void;