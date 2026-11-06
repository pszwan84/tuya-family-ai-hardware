import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { ERROR_CATALOG } from '@fah/contracts';

type Payload = { data?: unknown; meta?: unknown; code?: string; message?: string };

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((body: unknown) => {
        const requestId = request.requestId ?? 'r_unknown';
        if (body === undefined || body === null) {
          return {
            requestId,
            code: 'OK',
            message: ERROR_CATALOG.OK.message,
            data: null,
            retryable: false,
          };
        }
        if (typeof body === 'object' && body !== null && 'code' in body && 'data' in body) {
          return { requestId, ...(body as object) };
        }
        const payload = body as Payload;
        if ('data' in payload || 'meta' in payload) {
          const code = payload.code ?? (response.statusCode === 202 ? 'ACCEPTED' : 'OK');
          const hasItems = typeof body === 'object' && body !== null && 'items' in body;
          return {
            requestId,
            code,
            message: payload.message ?? (code === 'ACCEPTED' ? ERROR_CATALOG.ACCEPTED.message : ERROR_CATALOG.OK.message),
            data: 'data' in payload ? payload.data ?? null : hasItems ? body : null,
            retryable: false,
            meta: payload.meta,
          };
        }
        return {
          requestId,
          code: response.statusCode === 202 ? 'ACCEPTED' : 'OK',
          message: response.statusCode === 202 ? ERROR_CATALOG.ACCEPTED.message : ERROR_CATALOG.OK.message,
          data: body,
          retryable: false,
        };
      }),
    );
  }
}