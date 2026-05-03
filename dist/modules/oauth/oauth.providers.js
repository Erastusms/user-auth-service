"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAUTH_PROVIDERS = void 0;
exports.isValidProvider = isValidProvider;
exports.buildAuthorizationUrl = buildAuthorizationUrl;
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.fetchProviderUserInfo = fetchProviderUserInfo;
exports.encryptProviderToken = encryptProviderToken;
exports.decryptProviderToken = decryptProviderToken;
const env_1 = require("../../config/env");
const http_client_1 = require("../../lib/http-client");
const crypto_1 = require("../../lib/crypto");
const logger_1 = require("../../lib/logger");
const log = (0, logger_1.createLogger)('oauth.providers');
// ════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATIONS
// ════════════════════════════════════════════════════════════════
exports.OAUTH_PROVIDERS = {
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
function isValidProvider(slug) {
    return slug in exports.OAUTH_PROVIDERS;
}
// ── Ambil client credentials per provider ────────────────────
function getProviderCredentials(provider) {
    switch (provider) {
        case 'google':
            return {
                clientId: env_1.env.GOOGLE_CLIENT_ID,
                clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
                redirectUri: env_1.env.GOOGLE_REDIRECT_URI,
            };
        case 'github':
            return {
                clientId: env_1.env.GITHUB_CLIENT_ID,
                clientSecret: env_1.env.GITHUB_CLIENT_SECRET,
                redirectUri: env_1.env.GITHUB_REDIRECT_URI,
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
function buildAuthorizationUrl(provider, state, codeChallenge) {
    const config = exports.OAUTH_PROVIDERS[provider];
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
        params.set('access_type', 'offline'); // Minta refresh token
        params.set('prompt', 'select_account'); // Selalu tampilkan account picker
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
async function exchangeCodeForToken(provider, code, codeVerifier) {
    const config = exports.OAUTH_PROVIDERS[provider];
    const { clientId, clientSecret, redirectUri } = getProviderCredentials(provider);
    const params = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
    };
    const headers = {
        Accept: 'application/json', // GitHub default-nya text/plain kalau tidak set
    };
    const res = await (0, http_client_1.httpPostForm)(config.tokenUrl, params, headers);
    log.debug({ provider, status: res.status }, 'Token exchange response');
    if (res.status !== 200) {
        const errBody = res.body;
        const errMsg = errBody.error_description ?? errBody.error ?? 'Token exchange gagal';
        log.warn({ provider, status: res.status, error: errBody }, 'Token exchange failed');
        throw new Error(`OAuth token exchange error (${provider}): ${errMsg}`);
    }
    // GitHub bisa return error di body dengan status 200
    const body = res.body;
    if (body.error) {
        throw new Error(`OAuth error (${provider}): ${body.error_description ?? body.error}`);
    }
    return res.body;
}
// ════════════════════════════════════════════════════════════════
// USER INFO FETCHERS (per provider)
// ════════════════════════════════════════════════════════════════
async function fetchGoogleUserInfo(accessToken) {
    const config = exports.OAUTH_PROVIDERS.google;
    const res = await (0, http_client_1.httpGet)(config.userInfoUrl, {
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
        rawData: info,
    };
}
async function fetchGithubUserInfo(accessToken) {
    const config = exports.OAUTH_PROVIDERS.github;
    // 1. Ambil profil dasar
    const profileRes = await (0, http_client_1.httpGet)(config.userInfoUrl, {
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
        const emailsRes = await (0, http_client_1.httpGet)('https://api.github.com/user/emails', {
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
        rawData: profile,
    };
}
// ── Public dispatcher ─────────────────────────────────────────
async function fetchProviderUserInfo(provider, accessToken) {
    switch (provider) {
        case 'google':
            return fetchGoogleUserInfo(accessToken);
        case 'github':
            return fetchGithubUserInfo(accessToken);
    }
}
// ── Enkripsi / Dekripsi provider tokens sebelum simpan ke DB ─
function encryptProviderToken(token) {
    return (0, crypto_1.encrypt)(token);
}
function decryptProviderToken(encrypted) {
    return (0, crypto_1.decrypt)(encrypted);
}
//# sourceMappingURL=oauth.providers.js.map