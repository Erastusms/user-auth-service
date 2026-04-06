import { HTTP, ERROR_CODES, ErrorCode } from '@/config/constants';

// ── Base App Error ────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: unknown[],
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype); // Fix instanceof checks
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── 400 Bad Request ───────────────────────────────────────────
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown[]) {
    super(message, HTTP.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

// ── 401 Unauthorized ──────────────────────────────────────────
export class UnauthorizedError extends AppError {
  constructor(
    message = 'Unauthorized',
    code: ErrorCode = ERROR_CODES.UNAUTHORIZED
  ) {
    super(message, HTTP.UNAUTHORIZED, code);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Email atau password salah.') {
    super(message, HTTP.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token sudah kadaluarsa.') {
    super(message, HTTP.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
  }
}

export class TokenInvalidError extends AppError {
  constructor(message = 'Token tidak valid.') {
    super(message, HTTP.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
  }
}

// ── 403 Forbidden ─────────────────────────────────────────────
export class ForbiddenError extends AppError {
  constructor(
    message = 'Akses ditolak.',
    code: ErrorCode = ERROR_CODES.FORBIDDEN
  ) {
    super(message, HTTP.FORBIDDEN, code);
  }
}

export class AccountBannedError extends AppError {
  constructor(reason?: string) {
    super(
      reason ? `Akun Anda telah di-ban: ${reason}` : 'Akun Anda telah di-ban.',
      HTTP.FORBIDDEN,
      ERROR_CODES.ACCOUNT_BANNED
    );
  }
}

export class AccountInactiveError extends AppError {
  constructor(message = 'Akun tidak aktif.') {
    super(message, HTTP.FORBIDDEN, ERROR_CODES.ACCOUNT_INACTIVE);
  }
}

export class MfaRequiredError extends AppError {
  constructor(
    public readonly mfaToken: string,
    public readonly methods: string[]
  ) {
    super('Verifikasi MFA diperlukan.', HTTP.FORBIDDEN, ERROR_CODES.MFA_REQUIRED);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: {
        mfaToken: this.mfaToken,
        methods: this.methods,
      },
    };
  }
}

// ── 404 Not Found ─────────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} tidak ditemukan.`, HTTP.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
}

// ── 409 Conflict ─────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message = 'Data sudah ada.') {
    super(message, HTTP.CONFLICT, ERROR_CODES.CONFLICT);
  }
}

// ── 429 Rate Limit ────────────────────────────────────────────
export class RateLimitError extends AppError {
  constructor(message = 'Terlalu banyak request. Coba lagi nanti.') {
    super(message, HTTP.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED);
  }
}

// ── 500 Internal Error ────────────────────────────────────────
export class InternalError extends AppError {
  constructor(message = 'Terjadi kesalahan internal.') {
    super(message, HTTP.INTERNAL_ERROR, ERROR_CODES.INTERNAL_ERROR, undefined, false);
  }
}

// ── Validation Error (dari Zod) ───────────────────────────────
export interface ZodFieldError {
  field: string;
  message: string;
}

export class ValidationError extends AppError {
  public readonly fields: ZodFieldError[];

  constructor(fields: ZodFieldError[]) {
    super('Validasi input gagal.', HTTP.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    this.fields = fields;
  }
}
