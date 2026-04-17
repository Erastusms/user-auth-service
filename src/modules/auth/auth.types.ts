// ── Request Metadata ─────────────────────────────────────────
// Data dari HTTP request yang diperlukan service (IP, user agent, dll.)
export interface RequestMeta {
  ip: string;
  userAgent: string;
  deviceName?: string;
  deviceType?: string;
}

// ── Register ─────────────────────────────────────────────────
export interface RegisterResult {
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    emailVerified: boolean;
    createdAt: Date;
  };
  message: string;
}

// ── Login ─────────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // access token TTL dalam detik
}

export interface LoginResult {
  tokens: TokenPair;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    roles: string[];
    permissions: string[];
  };
  session: {
    id: string;
    deviceName: string;
    createdAt: Date;
  };
}

// ── Refresh ───────────────────────────────────────────────────
export interface RefreshResult {
  tokens: TokenPair;
}

// ── Revoke All ────────────────────────────────────────────────
export interface RevokeAllResult {
  revokedCount: number;
  message: string;
}

// ── Session Data ──────────────────────────────────────────────
export interface SessionData {
  id: string;
  userId: string;
  appId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

// ── DB Row shapes (setelah prisma query) ─────────────────────
// Digunakan untuk type-cast hasil query Prisma yang return `any`

export interface AppRow {
  id: string;
  slug: string;
  client_id: string;
  access_token_ttl: number;
  refresh_token_ttl: number;
  is_active: boolean;
  deleted_at: Date | null;
}

export interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  deleted_at: Date | null;
  email_verified_at: Date | null;
}

export interface UserRoleRow {
  roles: {
    slug: string;
    role_permissions: Array<{
      permissions: { slug: string };
    }>;
  };
}

export interface RefreshTokenRow {
  id: string;
  session_id: string;
  user_id: string;
  app_id: string;
  token_hash: string;
  family: string;
  used_at: Date | null;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  app_id: string;
  status: string;
  expires_at: Date;
}
