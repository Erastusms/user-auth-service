export interface JwtAccessPayload {
    sub: string;
    sessionId: string;
    appId: string;
    type: 'access';
    iat?: number;
    exp?: number;
}
export interface JwtRefreshPayload {
    sub: string;
    sessionId: string;
    appId: string;
    tokenFamily: string;
    type: 'refresh';
    iat?: number;
    exp?: number;
}
export type JwtPayload = JwtAccessPayload | JwtRefreshPayload;
export interface AuthUser {
    id: string;
    email: string | null;
    username: string | null;
    displayName: string | null;
    isActive: boolean;
    isBanned: boolean;
    sessionId: string;
    appId: string;
    roles: string[];
    permissions: string[];
}
declare module 'fastify' {
    interface FastifyRequest {
        authUser?: AuthUser;
        requestId: string;
    }
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
}
export interface IdParam {
    id: string;
}
export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple';
export type MfaType = 'totp' | 'sms' | 'email_otp' | 'webauthn';
export type SessionStatus = 'active' | 'expired' | 'revoked';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'banned';
export type TokenType = 'email_verification' | 'password_reset' | 'magic_link' | 'phone_verification';
