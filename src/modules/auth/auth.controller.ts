import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, createdResponse } from '@/shared/response';
import * as authService from './auth.service';
import type {
  RegisterDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RevokeAllDto,
} from './auth.schema';
import type { RequestMeta } from './auth.types';

// ── Helper: extract request metadata ─────────────────────────
function getRequestMeta(request: FastifyRequest): RequestMeta {
  return {
    ip:
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      '0.0.0.0',
    userAgent: request.headers['user-agent'] ?? 'unknown',
    deviceName: undefined, // akan di-override dari body jika ada
    deviceType: undefined,
  };
}

// ── POST /auth/register ───────────────────────────────────────
export async function registerHandler(
  request: FastifyRequest<{ Body: RegisterDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const result = await authService.register(
    request.body,
    getRequestMeta(request),
  );
  return createdResponse(reply, result);
}

// ── POST /auth/login ──────────────────────────────────────────
export async function loginHandler(
  request: FastifyRequest<{ Body: LoginDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const meta: RequestMeta = {
    ...getRequestMeta(request),
    deviceName: request.body.deviceName,
    deviceType: request.body.deviceType,
  };

  const result = await authService.login(request.body, meta);
  return successResponse(reply, result);
}

// ── POST /auth/logout ─────────────────────────────────────────
export async function logoutHandler(
  request: FastifyRequest<{ Body: LogoutDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  // authUser di-set oleh middleware authenticate
  const { id: userId, sessionId } = request.authUser!;

  await authService.logout(
    request.body,
    userId,
    sessionId,
    getRequestMeta(request),
  );

  return successResponse(reply, { message: 'Logout berhasil.' });
}

// ── POST /auth/refresh ────────────────────────────────────────
export async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const result = await authService.refresh(request.body);
  return successResponse(reply, result);
}

// ── POST /auth/revoke-all ─────────────────────────────────────
export async function revokeAllHandler(
  request: FastifyRequest<{ Body: RevokeAllDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { id: userId, sessionId } = request.authUser!;

  const result = await authService.revokeAll(
    request.body,
    userId,
    sessionId,
    getRequestMeta(request),
  );

  return successResponse(reply, result);
}
