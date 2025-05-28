import { Config } from '@types/index';

export const DEFAULT_CONFIG: Config = {
  apiKey: 'default-key',
  timeout: 3000,
  baseUrl: 'https://api.example.com'
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

export const API_ENDPOINTS = {
  USERS: '/users',
  AUTH: '/auth',
  PRODUCTS: '/products'
};