import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_CATALOG, type ErrorCode } from '@fah/contracts';
import { ApiError } from './api-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'r_unknown';

    if (exception instanceof ApiError) {
      response.status(exception.status).json({
        requestId,
        code: exception.code,
        message: exception.message,
        data: exception.fields ? { fields: exception.fields } : null,
        retryable: exception.retryable,
        retryAfterMs: exception.retryable ? 1000 : undefined,
        ...exception.extra,
      });
      return;
    }

    if (exception instanceof ZodError) {
      response.status(400).json({
        requestId,
        code: 'INVALID_METADATA',
        message: '请求参数不合法',
        data: { fields: exception.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) },
        retryable: false,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode =
        status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INVALID_METADATA';
      response.status(status).json({
        requestId,
        code,
        message: exception.message || ERROR_CATALOG[code].message,
        data: null,
        retryable: ERROR_CATALOG[code].retryable,
      });
      return;
    }

    response.status(500).json({
      requestId,
      code: 'INTERNAL',
      message: ERROR_CATALOG.INTERNAL.message,
      data: null,
      retryable: true,
      retryAfterMs: 1000,
    });
  }
}