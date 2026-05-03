import { ErrorCode } from '../config/constants';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: ErrorCode;
    readonly details?: unknown[];
    readonly isOperational: boolean;
    constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown[], isOperational?: boolean);
}
export declare class BadRequestError extends AppError {
    constructor(message?: string, details?: unknown[]);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, code?: ErrorCode);
}
export declare class InvalidCredentialsError extends AppError {
    constructor(message?: string);
}
export declare class TokenExpiredError extends AppError {
    constructor(message?: string);
}
export declare class TokenInvalidError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string, code?: ErrorCode);
}
export declare class AccountBannedError extends AppError {
    constructor(reason?: string);
}
export declare class AccountInactiveError extends AppError {
    constructor(message?: string);
}
export declare class MfaRequiredError extends AppError {
    readonly mfaToken: string;
    readonly methods: string[];
    constructor(mfaToken: string, methods: string[]);
    toJSON(): {
        code: ErrorCode;
        message: string;
        data: {
            mfaToken: string;
            methods: string[];
        };
    };
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class InternalError extends AppError {
    constructor(message?: string);
}
export interface ZodFieldError {
    field: string;
    message: string;
}
export declare class ValidationError extends AppError {
    readonly fields: ZodFieldError[];
    constructor(fields: ZodFieldError[]);
}
