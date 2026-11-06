import { env } from '../engine/core/Env.js';

/** Authentication, sessions, tokens, and role permissions. */
export default {
  defaultMode: 'browser',

  browser: {
    session: {
      driver: env('SESSION_DRIVER', env('REDIS_URL', '') ? 'redis' : 'file'),
      connection: 'session',
      lifetime: Number(env('TAAND_SESSION_LIFETIME', '120')),
      path: 'storage/sessions',
      cookie: env('TAAND_SESSION_COOKIE', 'taand_session'),
      secure: env('TAAND_SESSION_SECURE', env('TAAND_ENV', 'local') === 'production' ? 'true' : 'false') === 'true',
      sameSite: env('TAAND_SESSION_SAME_SITE', 'lax'),
      rememberDays: Number(env('TAAND_REMEMBER_DAYS', '14')),
    },
    remember: {
      cookie: env('TAAND_REMEMBER_COOKIE', 'taand_remember'),
    },
    pages: {
      login: '/login',
      register: '/register',
      home: '/dashboard',
    },
  },

  token: {
    prefix: env('TAAND_TOKEN_PREFIX', ''),
    expirationDays: Number(env('TAAND_TOKEN_EXPIRATION_DAYS', '0')) || null,
    fallback: env('TAAND_API_TOKEN', ''),
    machineAbilities: env('TAAND_MACHINE_ABILITIES', '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  accounts: {
    users: { driver: 'prisma', model: 'user' },
  },

  hashing: {
    scrypt: {
      N: 16384,
      r: 8,
      p: 1,
      keyLength: 64,
    },
  },

  roles: {
    hierarchy: { admin: 100, editor: 50, user: 10 },
    permissions: {
      admin: ['*'],
      editor: ['content.manage', 'content.view', 'profile.edit'],
      user: ['content.view', 'profile.edit'],
    },
  },
};
