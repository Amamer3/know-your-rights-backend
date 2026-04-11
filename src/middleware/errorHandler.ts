import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status =
    err instanceof AppError ? err.statusCode : (err as { statusCode?: number })?.statusCode ?? 500;
  const message =
    err instanceof Error
      ? err.message
      : (err as { message?: string })?.message ?? 'Something went wrong. Please try again.';
  const code =
    err instanceof AppError
      ? err.code
      : (err as { code?: string })?.code ?? 'SERVER_ERROR';

  console.error(`[Error] ${status} ${code}: ${message}`);
  if (!res.headersSent) {
    res.status(status).json({ error: message, code });
  }
}
