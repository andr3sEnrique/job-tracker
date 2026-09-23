import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** Maps known Prisma errors to HTTP responses instead of leaking 500s (and SQL details). */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const map: Record<string, { status: number; message: string }> = {
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
      P2002: { status: HttpStatus.CONFLICT, message: 'Resource already exists' },
      P2003: { status: HttpStatus.CONFLICT, message: 'Related resource constraint failed' },
    };
    const mapped = map[exception.code];
    if (!mapped) throw exception;
    response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
