import type { OAuthProviderSlug, OAuthProviderConfig, OAuthTokenResponse, NormalizedProviderUser } from './oauth.types';
export declare const OAUTH_PROVIDERS: Record<OAuthProviderSlug, OAuthProviderConfig>;
export declare function isValidProvider(slug: string): slug is OAuthProviderSlug;
/**
 * Build authorization URL untuk redirect user ke provider.
 * Menggunakan PKCE (S256) dan state untuk CSRF protection.
 */
export declare function buildAuthorizationUrl(provider: OAuthProviderSlug, state: string, codeChallenge: string): string;
/**
 * Tukar authorization code dengan access token dari provider.
 * Menggunakan PKCE code_verifier untuk verifikasi.
 */
export declare function exchangeCodeForToken(provider: OAuthProviderSlug, code: string, codeVerifier: string): Promise<OAuthTokenResponse>;
export declare function fetchProviderUserInfo(provider: OAuthProviderSlug, accessToken: string): Promise<NormalizedProviderUser>;
export declare function encryptProviderToken(token: string): string;
export declare function decryptProviderToken(encrypted: string): string;
