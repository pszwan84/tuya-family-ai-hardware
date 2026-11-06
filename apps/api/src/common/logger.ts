import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'fah-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-signature"]',
      'signatureUrl',
      '*.secret',
      'rawUrl',
      'gps',
      'exactAddress',
      'password',
      'passwordHash',
    ],
    censor: '[REDACTED]',
  },
});