export interface RequestMeta {
    ip: string;
    userAgent: string;
    deviceName?: string;
    deviceType?: string;
}
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
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
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
export interface RefreshResult {
    tokens: TokenPair;
}
export interface RevokeAllResult {
    revokedCount: number;
    message: string;
}
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
            permissions: {
                slug: string;
            };
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
