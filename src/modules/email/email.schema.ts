import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '@/middlewares/validate';

// ── Send Verification Email ───────────────────────────────────
export const SendVerificationSchema = z.object({
  email: EmailSchema,
});
export type SendVerificationDto = z.infer<typeof SendVerificationSchema>;

// ── Verify Email ──────────────────────────────────────────────
export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi.'),
});
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

// ── Forgot Password ───────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
  appClientId: z.string().min(1, 'appClientId wajib diisi.'),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

// ── Reset Password ────────────────────────────────────────────
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi.'),
  newPassword: PasswordSchema,
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

// ── Change Password (authenticated) ──────────────────────────
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'),
    newPassword: PasswordSchema,
    revokeOtherSessions: z.boolean().default(true),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Password baru tidak boleh sama dengan password saat ini.',
    path: ['newPassword'],
  });
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
