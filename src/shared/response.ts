import type { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { AppError, ValidationError, MfaRequiredError } from './errors';

export interface ApiMeta {
  timestamp: string;
  requestId: string;
}

export interface PaginationMeta extends ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

function buildMeta(requestId?: string): ApiMeta {
  return {
    timestamp: new Date().toISOString(),
    requestId: requestId ?? uuidv4(),
  };
}

export function successResponse<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200
): FastifyReply {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    meta: buildMeta(reply.request.id),
  };
  return reply.status(statusCode).send(body);
}

export function createdResponse<T>(reply: FastifyReply, data: T): FastifyReply {
  return successResponse(reply, data, 201);
}

export function paginatedResponse<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { page: number; limit: number; total: number }
): FastifyReply {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const body: PaginatedResponse<T> = {
    success: true,
    data,
    meta: {
      ...buildMeta(reply.request.id),
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
  return reply.status(200).send(body);
}

export function noContentResponse(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

export function errorResponse(
  reply: FastifyReply,
  error: AppError
): FastifyReply {
  let errorBody: ErrorResponse['error'];

  if (error instanceof ValidationError) {
    errorBody = { code: error.code, message: error.message, details: error.fields };
  } else if (error instanceof MfaRequiredError) {
    errorBody = error.toJSON();
  } else {
    errorBody = {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  const body: ErrorResponse = {
    success: false,
    error: errorBody,
    meta: buildMeta(reply.request.id),
  };

  return reply.status(error.statusCode).send(body);
}

export function parsePagination(query: { page?: string | number; limit?: string | number }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
