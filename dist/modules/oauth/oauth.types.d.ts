export type OAuthProviderSlug = 'google' | 'github';
export interface OAuthProviderConfig {
    slug: OAuthProviderSlug;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
    supportsPkce: boolean;
}
export interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
}
export interface GoogleUserInfo {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
}
export interface GitHubUserInfo {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
    bio: string | null;
    location: string | null;
    html_url: string;
}
export interface GitHubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
    visibility: string | null;
}
export interface NormalizedProviderUser {
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    locale: string | null;
    rawData: Record<string, unknown>;
}
export interface OAuthStateMetadata {
    appClientId: string;
    redirectUri?: string;
    action: 'login' | 'link';
}
export interface OAuthCallbackResult {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    isNewUser: boolean;
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
export interface OAuthLinkInitResult {
    authorizationUrl: string;
    message: string;
}
export interface OAuthUnlinkResult {
    message: string;
    remainingProviders: string[];
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
export interface IdentityRow {
    id: string;
    user_id: string;
    provider: string;
    provider_user_id: string;
    provider_email: string | null;
}
export interface OAuthStateRow {
    id: string;
    state: string;
    provider: string;
    app_id: string;
    redirect_uri: string;
    code_verifier: string | null;
    existing_user_id: string | null;
    metadata: Record<string, unknown>;
    expires_at: Date;
}
