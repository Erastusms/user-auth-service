import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '@/shared/response';
import * as oauthService from './oauth.service';
import type { OAuthInitQuery, OAuthCallbackQuery, OAuthLinkBody, OAuthUnlinkParam } from './oauth.schema';

// ── Helper: extract request metadata ─────────────────────────
function getMeta(req: FastifyRequest) {
  return {
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      '0.0.0.0',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

// ── GET /auth/oauth/:provider ─────────────────────────────────
// Redirect user ke halaman login provider
export async function initiateOAuthHandler(
  request: FastifyRequest<{
    Params: { provider: string };
    Querystring: OAuthInitQuery;
  }>,
  reply: FastifyReply
): Promise<void> {
  const authUrl = await oauthService.initiateOAuth(
    request.params.provider,
    request.query,
    {
      ip: getMeta(request).ip,
      existingUserId: request.authUser?.id, // undefined jika tidak login
    }
  );

  // HTTP 302 redirect ke provider
  void reply.redirect(302, authUrl);
}

// ── GET /auth/oauth/:provider/callback ───────────────────────
// Callback dari provider — selesaikan flow, return tokens
export async function oauthCallbackHandler(
  request: FastifyRequest<{
    Params: { provider: string };
    Querystring: OAuthCallbackQuery;
  }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await oauthService.handleOAuthCallback(
    request.params.provider,
    request.query,
    getMeta(request)
  );

  return successResponse(reply, result);
}

// ── POST /auth/oauth/link ─────────────────────────────────────
// Initiate link OAuth ke user yang sudah login
export async function linkOAuthHandler(
  request: FastifyRequest<{ Body: OAuthLinkBody }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { id: userId } = request.authUser!;
  // Ambil appClientId dari header X-App-Client-Id atau body
  const appClientId =
    (request.headers['x-app-client-id'] as string) ?? request.body.provider;

  const result = await oauthService.initiateLinkOAuth(
    request.body,
    userId,
    appClientId,
    { ip: getMeta(request).ip }
  );

  return successResponse(reply, result);
}

// ── DELETE /auth/oauth/link/:provider ────────────────────────
// Putus koneksi OAuth dari akun user
export async function unlinkOAuthHandler(
  request: FastifyRequest<{ Params: OAuthUnlinkParam }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await oauthService.unlinkOAuth(
    request.params,
    request.authUser!.id,
    getMeta(request)
  );

  return successResponse(reply, result);
}

// ── GET /auth/oauth/providers ─────────────────────────────────
// List semua provider yang terhubung ke akun user
export async function getLinkedProvidersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const providers = await oauthService.getLinkedProviders(request.authUser!.id);
  return successResponse(reply, { providers });
}
