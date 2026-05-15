import type { FastifyRequest, FastifyReply } from 'fastify';
import { createdResponse } from '@/shared/response';
import * as appsService from './apps.service';
import type { RegisterAppDto } from './apps.schema';

// ── Helper: extract request metadata ─────────────────────────
function getRequestMeta(request: FastifyRequest): {
  ip: string;
  userAgent: string;
} {
  return {
    ip:
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      '0.0.0.0',
    userAgent: request.headers['user-agent'] ?? 'unknown',
  };
}

// ── POST /apps/register ───────────────────────────────────────
export async function registerAppHandler(
  request: FastifyRequest<{ Body: RegisterAppDto }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const result = await appsService.registerApp(
    request.body,
    getRequestMeta(request),
  );
  return createdResponse(reply, result);
}
