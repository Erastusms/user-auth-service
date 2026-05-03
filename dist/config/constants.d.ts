export declare const HTTP: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_ERROR: 500;
};
export declare const ERROR_CODES: {
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly TOKEN_INVALID: "TOKEN_INVALID";
    readonly REFRESH_TOKEN_REUSE: "REFRESH_TOKEN_REUSE";
    readonly MFA_REQUIRED: "MFA_REQUIRED";
    readonly MFA_INVALID_CODE: "MFA_INVALID_CODE";
    readonly MFA_NOT_CONFIGURED: "MFA_NOT_CONFIGURED";
    readonly ACCOUNT_BANNED: "ACCOUNT_BANNED";
    readonly ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE";
    readonly ACCOUNT_NOT_VERIFIED: "ACCOUNT_NOT_VERIFIED";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly LAST_LOGIN_METHOD: "LAST_LOGIN_METHOD";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export declare const TOKEN_TYPES: {
    readonly EMAIL_VERIFICATION: "email_verification";
    readonly PASSWORD_RESET: "password_reset";
    readonly MAGIC_LINK: "magic_link";
    readonly PHONE_VERIFICATION: "phone_verification";
};
export declare const PROVIDERS: {
    readonly EMAIL: "email";
    readonly GOOGLE: "google";
    readonly GITHUB: "github";
    readonly MICROSOFT: "microsoft";
    readonly APPLE: "apple";
};
export type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];
export declare const SYSTEM_ROLES: {
    readonly SUPER_ADMIN: "super_admin";
    readonly SYSTEM: "system";
    readonly OWNER: "owner";
    readonly ADMIN: "admin";
    readonly MEMBER: "member";
    readonly VIEWER: "viewer";
};
export declare const MFA_TYPES: {
    readonly TOTP: "totp";
    readonly SMS: "sms";
    readonly EMAIL_OTP: "email_otp";
    readonly WEBAUTHN: "webauthn";
};
export declare const SESSION_STATUS: {
    readonly ACTIVE: "active";
    readonly EXPIRED: "expired";
    readonly REVOKED: "revoked";
};
export declare const MEMBERSHIP_STATUS: {
    readonly ACTIVE: "active";
    readonly INVITED: "invited";
    readonly SUSPENDED: "suspended";
    readonly BANNED: "banned";
};
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
export declare const PASSWORD_POLICY: {
    readonly MIN_LENGTH: 8;
    readonly MAX_LENGTH: 128;
    readonly BCRYPT_ROUNDS: 12;
    readonly HISTORY_COUNT: 5;
};
export declare const AUDIT_ACTIONS: {
    readonly USER_REGISTER: "user.register";
    readonly USER_LOGIN: "user.login";
    readonly USER_LOGOUT: "user.logout";
    readonly USER_LOGIN_FAILED: "user.login_failed";
    readonly USER_BANNED: "user.banned";
    readonly USER_UNBANNED: "user.unbanned";
    readonly USER_DELETED: "user.deleted";
    readonly USER_UPDATED: "user.updated";
    readonly PASSWORD_CHANGED: "password.changed";
    readonly PASSWORD_RESET_REQUESTED: "password.reset_requested";
    readonly PASSWORD_RESET_COMPLETED: "password.reset_completed";
    readonly EMAIL_VERIFIED: "email.verified";
    readonly MFA_ENABLED: "mfa.enabled";
    readonly MFA_DISABLED: "mfa.disabled";
    readonly MFA_VERIFIED: "mfa.verified";
    readonly MFA_FAILED: "mfa.failed";
    readonly TOKEN_REFRESHED: "token.refreshed";
    readonly TOKEN_REVOKE_ALL: "token.revoke_all";
    readonly REFRESH_TOKEN_REUSE: "token.refresh_reuse_attack";
    readonly OAUTH_LINKED: "oauth.linked";
    readonly OAUTH_UNLINKED: "oauth.unlinked";
    readonly ROLE_ASSIGNED: "role.assigned";
    readonly ROLE_REVOKED: "role.revoked";
    readonly SESSION_REVOKED: "session.revoked";
};
