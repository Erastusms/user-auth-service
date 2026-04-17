// ── Provider Config ───────────────────────────────────────────
export type OAuthProviderSlug = 'google' | 'github';

export interface OAuthProviderConfig {
  slug: OAuthProviderSlug;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  supportsPkce: boolean;
}

// ── Token Exchange Result ─────────────────────────────────────
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // Google OpenID Connect
}

// ── Provider User Info ────────────────────────────────────────
export interface GoogleUserInfo {
  sub: string;           // Unique Google ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export interface GitHubUserInfo {
  id: number;            // Unique GitHub ID (angka)
  login: string;         // Username GitHub
  name: string | null;
  email: string | null;  // Bisa null jika email di-private di GitHub settings
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

// ── Normalized Provider User (setelah mapping dari masing-masing provider) ──
export interface NormalizedProviderUser {
  providerUserId: string;    // ID unik dari provider (selalu string)
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  rawData: Record<string, unknown>; // Raw response untuk disimpan di identities.provider_data
}

// ── OAuth Flow State (disimpan di oauth_states) ───────────────
export interface OAuthStateMetadata {
  appClientId: string;
  redirectUri?: string;     // Frontend redirect setelah selesai
  action: 'login' | 'link'; // Login baru atau link ke existing user
}

// ── OAuth Callback Result (dikembalikan ke controller) ────────
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

// ── Link Result ───────────────────────────────────────────────
export interface OAuthLinkInitResult {
  authorizationUrl: string;
  message: string;
}

export interface OAuthUnlinkResult {
  message: string;
  remainingProviders: string[];
}

// ── DB Row types (Prisma return any) ─────────────────────────
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
