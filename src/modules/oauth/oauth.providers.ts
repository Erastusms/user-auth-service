import { env } from '@/config/env';
import { httpPostForm, httpGet } from '@/lib/http-client';
import { decrypt, encrypt } from '@/lib/crypto';
import { createLogger } from '@/lib/logger';
import type {
  OAuthProviderSlug,
  OAuthProviderConfig,
  OAuthTokenResponse,
  GoogleUserInfo,
  GitHubUserInfo,
  GitHubEmail,
  NormalizedProviderUser,
} from './oauth.types';

const log = createLogger('oauth.providers');

// ════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATIONS
// ════════════════════════════════════════════════════════════════

export const OAUTH_PROVIDERS: Record<OAuthProviderSlug, OAuthProviderConfig> = {
  google: {
    slug: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    supportsPkce: true,
  },
  github: {
    slug: 'github',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    supportsPkce: true, // GitHub support PKCE sejak 2023
  },
};

// ── Validasi provider yang didukung ──────────────────────────
export function isValidProvider(slug: string): slug is OAuthProviderSlug {
  return slug in OAUTH_PROVIDERS;
}

// ── Ambil client credentials per provider ────────────────────
function getProviderCredentials(
  provider: OAuthProviderSlug
): { clientId: string; clientSecret: string; redirectUri: string } {
  switch (provider) {
    case 'google':
      return {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,
      };
    case 'github':
      return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: env.GITHUB_REDIRECT_URI,
      };
  }
}

// ════════════════════════════════════════════════════════════════
// AUTHORIZATION URL BUILDER
// ════════════════════════════════════════════════════════════════

/**
 * Build authorization URL untuk redirect user ke provider.
 * Menggunakan PKCE (S256) dan state untuk CSRF protection.
 */
export function buildAuthorizationUrl(
  provider: OAuthProviderSlug,
  state: string,
  codeChallenge: string
): string {
  const config = OAUTH_PROVIDERS[provider];
  const { clientId, redirectUri } = getProviderCredentials(provider);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Provider-specific extra params
  if (provider === 'google') {
    params.set('access_type', 'offline');    // Minta refresh token
    params.set('prompt', 'select_account');  // Selalu tampilkan account picker
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

// ════════════════════════════════════════════════════════════════
// TOKEN EXCHANGE
// ════════════════════════════════════════════════════════════════

/**
 * Tukar authorization code dengan access token dari provider.
 * Menggunakan PKCE code_verifier untuk verifikasi.
 */
export async function exchangeCodeForToken(
  provider: OAuthProviderSlug,
  code: string,
  codeVerifier: string
): Promise<OAuthTokenResponse> {
  const config = OAUTH_PROVIDERS[provider];
  const { clientId, clientSecret, redirectUri } = getProviderCredentials(provider);

  const params: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  };

  const headers: Record<string, string> = {
    Accept: 'application/json', // GitHub default-nya text/plain kalau tidak set
  };

  const res = await httpPostForm<OAuthTokenResponse>(config.tokenUrl, params, headers);

  log.debug({ provider, status: res.status }, 'Token exchange response');

  if (res.status !== 200) {
    const errBody = res.body as unknown as Record<string, string>;
    const errMsg = errBody.error_description ?? errBody.error ?? 'Token exchange gagal';
    log.warn({ provider, status: res.status, error: errBody }, 'Token exchange failed');
    throw new Error(`OAuth token exchange error (${provider}): ${errMsg}`);
  }

  // GitHub bisa return error di body dengan status 200
  const body = res.body as unknown as Record<string, string>;
  if (body.error) {
    throw new Error(`OAuth error (${provider}): ${body.error_description ?? body.error}`);
  }

  return res.body as OAuthTokenResponse;
}

// ════════════════════════════════════════════════════════════════
// USER INFO FETCHERS (per provider)
// ════════════════════════════════════════════════════════════════

async function fetchGoogleUserInfo(accessToken: string): Promise<NormalizedProviderUser> {
  const config = OAUTH_PROVIDERS.google;
  const res = await httpGet<GoogleUserInfo>(config.userInfoUrl, {
    Authorization: `Bearer ${accessToken}`,
  });

  if (res.status !== 200) {
    throw new Error('Gagal mengambil user info dari Google');
  }

  const info = res.body;

  return {
    providerUserId: info.sub,
    email: info.email ?? null,
    emailVerified: info.email_verified ?? false,
    displayName: info.name,
    firstName: info.given_name ?? null,
    lastName: info.family_name ?? null,
    avatarUrl: info.picture ?? null,
    locale: info.locale ?? null,
    rawData: info as unknown as Record<string, unknown>,
  };
}

async function fetchGithubUserInfo(accessToken: string): Promise<NormalizedProviderUser> {
  const config = OAUTH_PROVIDERS.github;

  // 1. Ambil profil dasar
  const profileRes = await httpGet<GitHubUserInfo>(config.userInfoUrl, {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  if (profileRes.status !== 200) {
    throw new Error('Gagal mengambil user info dari GitHub');
  }

  const profile = profileRes.body;
  let email = profile.email;

  // 2. Jika email null (private di GitHub settings), ambil dari /user/emails
  if (!email) {
    const emailsRes = await httpGet<GitHubEmail[]>('https://api.github.com/user/emails', {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });

    if (emailsRes.status === 200 && Array.isArray(emailsRes.body)) {
      const primaryVerified = emailsRes.body.find((e) => e.primary && e.verified);
      const primaryAny = emailsRes.body.find((e) => e.primary);
      email = primaryVerified?.email ?? primaryAny?.email ?? null;
    }
  }

  // Parse nama depan/belakang dari name jika ada
  const nameParts = (profile.name ?? profile.login).split(' ');
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  return {
    providerUserId: String(profile.id),
    email,
    emailVerified: email !== null, // GitHub hanya return verified emails
    displayName: profile.name ?? profile.login,
    firstName,
    lastName,
    avatarUrl: profile.avatar_url,
    locale: null, // GitHub tidak return locale
    rawData: profile as unknown as Record<string, unknown>,
  };
}

// ── Public dispatcher ─────────────────────────────────────────
export async function fetchProviderUserInfo(
  provider: OAuthProviderSlug,
  accessToken: string
): Promise<NormalizedProviderUser> {
  switch (provider) {
    case 'google':
      return fetchGoogleUserInfo(accessToken);
    case 'github':
      return fetchGithubUserInfo(accessToken);
  }
}

// ── Enkripsi / Dekripsi provider tokens sebelum simpan ke DB ─
export function encryptProviderToken(token: string): string {
  return encrypt(token);
}

export function decryptProviderToken(encrypted: string): string {
  return decrypt(encrypted);
}
