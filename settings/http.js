import { env } from '../engine/core/Env.js';

/** HTTP pipeline — global middleware, stacks, filters, and cross-origin rules. */
export default {
  global: [
    'trustProxies',
    'cors',
    'validateSize',
    'trim',
    'log',
    'security',
  ],

  stacks: {
    browser: ['startSession', 'csrf'],
    json: ['json', 'throttle:120,1'],
  },

  filters: {
    signedIn: 'authenticate',
    signedOut: 'guestOnly',
  },

  priority: [
    'trustProxies',
    'cors',
    'validateSize',
    'trim',
    'startSession',
    'security',
    'throttle',
    'lockout',
    'authenticate',
    'role',
    'can',
    'csrf',
    'json',
    'log',
  ],

  crossOrigin: {
    enabled: env('CORS_ENABLED', 'true') !== 'false',
    paths: ['api/*'],
    allowedOrigins: env('CORS_ALLOWED_ORIGINS', '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-CSRF-TOKEN',
      'X-Api-Key',
      'X-XSRF-TOKEN',
    ],
    exposedHeaders: [],
    maxAge: Number(env('CORS_MAX_AGE', '0')),
    supportsCredentials: env('CORS_SUPPORTS_CREDENTIALS', 'false') === 'true',
  },
};
