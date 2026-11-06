import { ERROR_CATALOG, type ErrorCode, type FieldErrorLike } from './types';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly fields?: FieldErrorLike[];
  readonly extra?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, fields?: FieldErrorLike[], extra?: Record<string, unknown>) {
    super(message ?? ERROR_CATALOG[code].message);
    this.code = code;
    this.fields = fields;
    this.extra = extra;
  }

  get status(): number {
    return ERROR_CATALOG[this.code].status;
  }

  get retryable(): boolean {
    return ERROR_CATALOG[this.code].retryable;
  }
}