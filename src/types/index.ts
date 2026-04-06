import type { FastifyRequest } from 'fastify';

// ── JWT Payload ───────────────────────────────────────────────
export interface JwtAccessPayload {
  sub: string;        // user.id
  sessionId: string;  // sessions.id
  appId: string;      // apps.id
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;        // user.id
  sessionId: string;
  appId: string;
  tokenFamily: string; // refresh_tokens.family
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export type JwtPayload = JwtAccessPayload | JwtRefreshPayload;

// ── Auth Context (di-attach ke request setelah authenticate) ──
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

// ── Fastify Type Augmentation ─────────────────────────────────
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
    requestId: string;
  }
}

// ── Pagination ────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ── Generic ID Param ─────────────────────────────────────────
export interface IdParam {
  id: string;
}

// ── Provider Types ────────────────────────────────────────────
export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple';
export type MfaType = 'totp' | 'sms' | 'email_otp' | 'webauthn';
export type SessionStatus = 'active' | 'expired' | 'revoked';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'banned';
export type TokenType =
  | 'email_verification'
  | 'password_reset'
  | 'magic_link'
  | 'phone_verification';
