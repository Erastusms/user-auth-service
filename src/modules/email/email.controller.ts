import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '@/shared/response';
import * as emailService from './email.service';
import type {
  SendVerificationDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './email.schema';

function getMeta(req: FastifyRequest) {
  return {
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      '0.0.0.0',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

// ── POST /auth/email/send-verification ───────────────────────
export async function sendVerificationHandler(
  request: FastifyRequest<{ Body: SendVerificationDto }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await emailService.sendEmailVerification(
    request.body,
    getMeta(request)
  );
  return successResponse(reply, result);
}

// ── POST /auth/email/verify ───────────────────────────────────
export async function verifyEmailHandler(
  request: FastifyRequest<{ Body: VerifyEmailDto }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await emailService.verifyEmail(request.body, getMeta(request));
  return successResponse(reply, result);
}

// ── POST /auth/password/forgot ────────────────────────────────
export async function forgotPasswordHandler(
  request: FastifyRequest<{ Body: ForgotPasswordDto }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await emailService.forgotPassword(request.body, getMeta(request));
  return successResponse(reply, result);
}

// ── POST /auth/password/reset ─────────────────────────────────
export async function resetPasswordHandler(
  request: FastifyRequest<{ Body: ResetPasswordDto }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await emailService.resetPassword(request.body, getMeta(request));
  return successResponse(reply, result);
}

// ── PUT /auth/password/change ─────────────────────────────────
export async function changePasswordHandler(
  request: FastifyRequest<{ Body: ChangePasswordDto }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { id: userId, sessionId } = request.authUser!;
  const result = await emailService.changePassword(
    request.body,
    userId,
    sessionId,
    getMeta(request)
  );
  return successResponse(reply, result);
}
