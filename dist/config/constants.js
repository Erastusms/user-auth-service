"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_ACTIONS = exports.PASSWORD_POLICY = exports.PAGINATION = exports.MEMBERSHIP_STATUS = exports.SESSION_STATUS = exports.MFA_TYPES = exports.SYSTEM_ROLES = exports.PROVIDERS = exports.TOKEN_TYPES = exports.ERROR_CODES = exports.HTTP = void 0;
// ── HTTP Status Codes ─────────────────────────────────────────
exports.HTTP = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
};
// ── Error Codes (digunakan di response JSON) ─────────────────
exports.ERROR_CODES = {
    // Auth
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    UNAUTHORIZED: 'UNAUTHORIZED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    REFRESH_TOKEN_REUSE: 'REFRESH_TOKEN_REUSE',
    MFA_REQUIRED: 'MFA_REQUIRED',
    MFA_INVALID_CODE: 'MFA_INVALID_CODE',
    MFA_NOT_CONFIGURED: 'MFA_NOT_CONFIGURED',
    // Account
    ACCOUNT_BANNED: 'ACCOUNT_BANNED',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_TOKEN: 'INVALID_TOKEN',
    // Resource
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    FORBIDDEN: 'FORBIDDEN',
    LAST_LOGIN_METHOD: 'LAST_LOGIN_METHOD',
    // Rate limit
    RATE_LIMITED: 'RATE_LIMITED',
    // Server
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};
// ── Token Types ───────────────────────────────────────────────
exports.TOKEN_TYPES = {
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
    MAGIC_LINK: 'magic_link',
    PHONE_VERIFICATION: 'phone_verification',
};
// ── Provider Types ────────────────────────────────────────────
exports.PROVIDERS = {
    EMAIL: 'email',
    GOOGLE: 'google',
    GITHUB: 'github',
    MICROSOFT: 'microsoft',
    APPLE: 'apple',
};
// ── Role Slugs (system roles) ─────────────────────────────────
exports.SYSTEM_ROLES = {
    SUPER_ADMIN: 'super_admin',
    SYSTEM: 'system',
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
};
// ── MFA Types ─────────────────────────────────────────────────
exports.MFA_TYPES = {
    TOTP: 'totp',
    SMS: 'sms',
    EMAIL_OTP: 'email_otp',
    WEBAUTHN: 'webauthn',
};
// ── Session Status ────────────────────────────────────────────
exports.SESSION_STATUS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
};
// ── Membership Status ─────────────────────────────────────────
exports.MEMBERSHIP_STATUS = {
    ACTIVE: 'active',
    INVITED: 'invited',
    SUSPENDED: 'suspended',
    BANNED: 'banned',
};
// ── Pagination Defaults ───────────────────────────────────────
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
// ── Password Policy ───────────────────────────────────────────
exports.PASSWORD_POLICY = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    BCRYPT_ROUNDS: 12,
    HISTORY_COUNT: 5, // tidak boleh reuse 5 password terakhir
};
// ── Audit Log Actions ─────────────────────────────────────────
exports.AUDIT_ACTIONS = {
    USER_REGISTER: 'user.register',
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_LOGIN_FAILED: 'user.login_failed',
    USER_BANNED: 'user.banned',
    USER_UNBANNED: 'user.unbanned',
    USER_DELETED: 'user.deleted',
    USER_UPDATED: 'user.updated',
    PASSWORD_CHANGED: 'password.changed',
    PASSWORD_RESET_REQUESTED: 'password.reset_requested',
    PASSWORD_RESET_COMPLETED: 'password.reset_completed',
    EMAIL_VERIFIED: 'email.verified',
    MFA_ENABLED: 'mfa.enabled',
    MFA_DISABLED: 'mfa.disabled',
    MFA_VERIFIED: 'mfa.verified',
    MFA_FAILED: 'mfa.failed',
    TOKEN_REFRESHED: 'token.refreshed',
    TOKEN_REVOKE_ALL: 'token.revoke_all',
    REFRESH_TOKEN_REUSE: 'token.refresh_reuse_attack',
    OAUTH_LINKED: 'oauth.linked',
    OAUTH_UNLINKED: 'oauth.unlinked',
    ROLE_ASSIGNED: 'role.assigned',
    ROLE_REVOKED: 'role.revoked',
    SESSION_REVOKED: 'session.revoked',
};
//# sourceMappingURL=constants.js.map