import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exception.filter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { logger } from './common/logger';

function loadEnv(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    return;
  }
}

async function bootstrap(): Promise<void> {
  loadEnv();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  app.use(json({ limit: '2mb' }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id', 'x-demo-key', 'x-timestamp', 'x-nonce', 'x-signature'],
  });
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const server = app.getHttpAdapter().getInstance();
  server.get('/healthz', (_request: unknown, response: { json: (body: unknown) => void }) => {
    response.json({ status: 'ok', service: 'fah-api' });
  });
  server.get('/readyz', (_request: unknown, response: { json: (body: unknown) => void }) => {
    response.json({ status: 'ready' });
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'api started');
}

bootstrap().catch((error) => {
  console.error(error);
  logger.error({ err: error }, 'api failed to start');
  process.exitCode = 1;
});