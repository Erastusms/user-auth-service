// ── HTTP Status Codes ─────────────────────────────────────────
export const HTTP = {
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
} as const;

// ── Error Codes (digunakan di response JSON) ─────────────────
export const ERROR_CODES = {
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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── Token Types ───────────────────────────────────────────────
export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  MAGIC_LINK: 'magic_link',
  PHONE_VERIFICATION: 'phone_verification',
} as const;

// ── Provider Types ────────────────────────────────────────────
export const PROVIDERS = {
  EMAIL: 'email',
  GOOGLE: 'google',
  GITHUB: 'github',
  MICROSOFT: 'microsoft',
  APPLE: 'apple',
} as const;

export type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

// ── Role Slugs (system roles) ─────────────────────────────────
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM: 'system',
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// ── MFA Types ─────────────────────────────────────────────────
export const MFA_TYPES = {
  TOTP: 'totp',
  SMS: 'sms',
  EMAIL_OTP: 'email_otp',
  WEBAUTHN: 'webauthn',
} as const;

// ── Session Status ────────────────────────────────────────────
export const SESSION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

// ── Membership Status ─────────────────────────────────────────
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  INVITED: 'invited',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
} as const;

// ── Pagination Defaults ───────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ── Password Policy ───────────────────────────────────────────
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  BCRYPT_ROUNDS: 12,
  HISTORY_COUNT: 5, // tidak boleh reuse 5 password terakhir
} as const;

// ── Audit Log Actions ─────────────────────────────────────────
export const AUDIT_ACTIONS = {
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
} as const;
