/**
 * Structured errors. Every boundary — HTTP, MCP, adapter — reports failures
 * with the same `{ code, message, details }` envelope.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toEnvelope(): { code: string; message: string; details?: unknown } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

export const errors = {
  unauthorized: (message = 'Authentication required.') =>
    new AppError('unauthorized', message, 401),
  forbidden: (message = 'You do not have access to this resource.') =>
    new AppError('forbidden', message, 403),
  notFound: (what = 'Resource') => new AppError('not_found', `${what} not found.`, 404),
  conflict: (message: string, details?: unknown) => new AppError('conflict', message, 409, details),
  validation: (message: string, details?: unknown) =>
    new AppError('validation_failed', message, 422, details),
  badRequest: (message: string, details?: unknown) =>
    new AppError('bad_request', message, 400, details),
  revisionMismatch: (expected: number, actual: number, subject = 'resource') =>
    new AppError(
      'revision_conflict',
      `The ${subject} changed since it was read (expected revision ${expected}, current ${actual}).`,
      409,
      { expectedRevision: expected, currentRevision: actual },
    ),
  limitExceeded: (message: string, details?: unknown) =>
    new AppError('limit_exceeded', message, 429, details),
};
