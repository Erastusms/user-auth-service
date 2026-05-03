import type { FastifyReply } from 'fastify';
import { AppError } from './errors';
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
export declare function successResponse<T>(reply: FastifyReply, data: T, statusCode?: number): FastifyReply;
export declare function createdResponse<T>(reply: FastifyReply, data: T): FastifyReply;
export declare function paginatedResponse<T>(reply: FastifyReply, data: T[], pagination: {
    page: number;
    limit: number;
    total: number;
}): FastifyReply;
export declare function noContentResponse(reply: FastifyReply): FastifyReply;
export declare function errorResponse(reply: FastifyReply, error: AppError): FastifyReply;
export declare function parsePagination(query: {
    page?: string | number;
    limit?: string | number;
}): {
    page: number;
    limit: number;
    skip: number;
};
