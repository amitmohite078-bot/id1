import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode } from '@salonbridge/types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function formatErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id,
      },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.flatten(),
        requestId: request.id,
      },
    });
  }

  // Fastify validation error from fastify-type-provider-zod
  const fastifyErr = error as { statusCode?: number; validation?: unknown; code?: string };
  if (fastifyErr.validation) {
    return reply.status(400).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
        details: fastifyErr.validation,
        requestId: request.id,
      },
    });
  }

  request.log.error({ err: error }, 'Unhandled API error');
  return reply.status(fastifyErr.statusCode ?? 500).send({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      requestId: request.id,
    },
  });
}

