// ===========================================
// ERROR HANDLER MIDDLEWARE
// ===========================================

import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

// Custom error class for API errors
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();

  // Log error for debugging
  console.error(`[${requestId}] Error:`, {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle HTTPException from Hono
  if (err instanceof HTTPException) {
    return c.json<ApiError>(
      {
        error: err.message,
        message: err.message,
        requestId,
      },
      err.status
    );
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return c.json<ApiError>(
      {
        error: err.name,
        message: err.message,
        details: err.details,
        requestId,
      },
      err.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return c.json<ApiError>(
      {
        error: 'Validation Error',
        message: 'Invalid request data',
        details: (err as any).errors,
        requestId,
      },
      400
    );
  }

  // Handle database errors
  if (err.message?.includes('duplicate key')) {
    return c.json<ApiError>(
      {
        error: 'Conflict',
        message: 'Resource already exists',
        requestId,
      },
      409
    );
  }

  // Generic server error
  return c.json<ApiError>(
    {
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'An unexpected error occurred',
      requestId,
    },
    500
  );
};

