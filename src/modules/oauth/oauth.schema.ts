import { z } from 'zod';

// ── Path param: provider ──────────────────────────────────────
export const ProviderParamSchema = z.object({
  provider: z.enum(['google', 'github'], {
    errorMap: () => ({
      message: "Provider tidak valid. Pilih: 'google' atau 'github'.",
    }),
  }),
});

// ── Query: inisiasi OAuth ─────────────────────────────────────
export const OAuthInitQuerySchema = z.object({
  appClientId: z.string().min(1, 'appClientId wajib diisi.'),
  // redirectUri opsional — URL frontend setelah OAuth selesai
  // (bukan OAuth callback URI, tapi redirect setelah kita proses di backend)
  redirectUri: z.string().url('redirectUri harus berupa URL yang valid.').optional(),
});

export type OAuthInitQuery = z.infer<typeof OAuthInitQuerySchema>;

// ── Query: OAuth callback ─────────────────────────────────────
export const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code tidak boleh kosong.'),
  state: z.string().min(1, 'State tidak boleh kosong.'),
  // Error fields dari provider (jika user deny atau ada error)
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>;

// ── Body: link OAuth ke existing user ─────────────────────────
export const OAuthLinkBodySchema = z.object({
  provider: z.enum(['google', 'github'], {
    errorMap: () => ({ message: "Provider tidak valid. Pilih: 'google' atau 'github'." }),
  }),
  redirectUri: z
    .string()
    .url('redirectUri harus berupa URL yang valid.')
    .optional(),
});

export type OAuthLinkBody = z.infer<typeof OAuthLinkBodySchema>;

// ── Path param: provider untuk unlink ────────────────────────
export const OAuthUnlinkParamSchema = z.object({
  provider: z.enum(['google', 'github'], {
    errorMap: () => ({ message: "Provider tidak valid. Pilih: 'google' atau 'github'." }),
  }),
});

export type OAuthUnlinkParam = z.infer<typeof OAuthUnlinkParamSchema>;
