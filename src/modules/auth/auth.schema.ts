import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '@/middlewares/validate';

// ── Register ──────────────────────────────────────────────────
export const RegisterSchema = z.object({
  appClientId: z.string().min(1, 'appClientId wajib diisi.'),
  email: EmailSchema,
  password: PasswordSchema,
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter.')
    .max(50, 'Username maksimal 50 karakter.')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username hanya boleh berisi huruf, angka, underscore (_), dan dash (-).',
    )
    .toLowerCase()
    .optional(),
  displayName: z
    .string()
    .min(1, 'Display name tidak boleh kosong.')
    .max(150, 'Display name maksimal 150 karakter.')
    .optional(),
  locale: z.string().max(10).default('id'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

// ── Login ─────────────────────────────────────────────────────
export const LoginSchema = z.object({
  appClientId: z.string().min(1, 'appClientId wajib diisi.'),
  email: EmailSchema,
  password: z.string().min(1, 'Password wajib diisi.'),
  deviceName: z
    .string()
    .max(255)
    .optional()
    .transform((v) => v ?? 'Unknown Device'),
  deviceType: z
    .enum(['browser', 'mobile', 'desktop', 'api'])
    .default('browser'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

// ── Logout ────────────────────────────────────────────────────
export const LogoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken wajib diisi.'),
});

export type LogoutDto = z.infer<typeof LogoutSchema>;

// ── Refresh Token ─────────────────────────────────────────────
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken wajib diisi.'),
  appClientId: z.string().min(1, 'appClientId wajib diisi.'),
});

export type RefreshDto = z.infer<typeof RefreshSchema>;

// ── Revoke All ────────────────────────────────────────────────
export const RevokeAllSchema = z.object({
  exceptCurrentSession: z.boolean().default(false),
});

export type RevokeAllDto = z.infer<typeof RevokeAllSchema>;
