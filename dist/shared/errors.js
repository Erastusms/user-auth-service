"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.InternalError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.MfaRequiredError = exports.AccountInactiveError = exports.AccountBannedError = exports.ForbiddenError = exports.TokenInvalidError = exports.TokenExpiredError = exports.InvalidCredentialsError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
const constants_1 = require("../config/constants");
// ── Base App Error ────────────────────────────────────────────
class AppError extends Error {
    statusCode;
    code;
    details;
    isOperational;
    constructor(message, statusCode, code, details, isOperational = true) {
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
exports.AppError = AppError;
// ── 400 Bad Request ───────────────────────────────────────────
class BadRequestError extends AppError {
    constructor(message = 'Bad request', details) {
        super(message, constants_1.HTTP.BAD_REQUEST, constants_1.ERROR_CODES.VALIDATION_ERROR, details);
    }
}
exports.BadRequestError = BadRequestError;
// ── 401 Unauthorized ──────────────────────────────────────────
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = constants_1.ERROR_CODES.UNAUTHORIZED) {
        super(message, constants_1.HTTP.UNAUTHORIZED, code);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class InvalidCredentialsError extends AppError {
    constructor(message = 'Email atau password salah.') {
        super(message, constants_1.HTTP.UNAUTHORIZED, constants_1.ERROR_CODES.INVALID_CREDENTIALS);
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class TokenExpiredError extends AppError {
    constructor(message = 'Token sudah kadaluarsa.') {
        super(message, constants_1.HTTP.UNAUTHORIZED, constants_1.ERROR_CODES.TOKEN_EXPIRED);
    }
}
exports.TokenExpiredError = TokenExpiredError;
class TokenInvalidError extends AppError {
    constructor(message = 'Token tidak valid.') {
        super(message, constants_1.HTTP.UNAUTHORIZED, constants_1.ERROR_CODES.TOKEN_INVALID);
    }
}
exports.TokenInvalidError = TokenInvalidError;
// ── 403 Forbidden ─────────────────────────────────────────────
class ForbiddenError extends AppError {
    constructor(message = 'Akses ditolak.', code = constants_1.ERROR_CODES.FORBIDDEN) {
        super(message, constants_1.HTTP.FORBIDDEN, code);
    }
}
exports.ForbiddenError = ForbiddenError;
class AccountBannedError extends AppError {
    constructor(reason) {
        super(reason ? `Akun Anda telah di-ban: ${reason}` : 'Akun Anda telah di-ban.', constants_1.HTTP.FORBIDDEN, constants_1.ERROR_CODES.ACCOUNT_BANNED);
    }
}
exports.AccountBannedError = AccountBannedError;
class AccountInactiveError extends AppError {
    constructor(message = 'Akun tidak aktif.') {
        super(message, constants_1.HTTP.FORBIDDEN, constants_1.ERROR_CODES.ACCOUNT_INACTIVE);
    }
}
exports.AccountInactiveError = AccountInactiveError;
class MfaRequiredError extends AppError {
    mfaToken;
    methods;
    constructor(mfaToken, methods) {
        super('Verifikasi MFA diperlukan.', constants_1.HTTP.FORBIDDEN, constants_1.ERROR_CODES.MFA_REQUIRED);
        this.mfaToken = mfaToken;
        this.methods = methods;
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
exports.MfaRequiredError = MfaRequiredError;
// ── 404 Not Found ─────────────────────────────────────────────
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} tidak ditemukan.`, constants_1.HTTP.NOT_FOUND, constants_1.ERROR_CODES.NOT_FOUND);
    }
}
exports.NotFoundError = NotFoundError;
// ── 409 Conflict ─────────────────────────────────────────────
class ConflictError extends AppError {
    constructor(message = 'Data sudah ada.') {
        super(message, constants_1.HTTP.CONFLICT, constants_1.ERROR_CODES.CONFLICT);
    }
}
exports.ConflictError = ConflictError;
// ── 429 Rate Limit ────────────────────────────────────────────
class RateLimitError extends AppError {
    constructor(message = 'Terlalu banyak request. Coba lagi nanti.') {
        super(message, constants_1.HTTP.TOO_MANY_REQUESTS, constants_1.ERROR_CODES.RATE_LIMITED);
    }
}
exports.RateLimitError = RateLimitError;
// ── 500 Internal Error ────────────────────────────────────────
class InternalError extends AppError {
    constructor(message = 'Terjadi kesalahan internal.') {
        super(message, constants_1.HTTP.INTERNAL_ERROR, constants_1.ERROR_CODES.INTERNAL_ERROR, undefined, false);
    }
}
exports.InternalError = InternalError;
class ValidationError extends AppError {
    fields;
    constructor(fields) {
        super('Validasi input gagal.', constants_1.HTTP.BAD_REQUEST, constants_1.ERROR_CODES.VALIDATION_ERROR);
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=errors.js.map