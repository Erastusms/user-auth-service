"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthUnlinkParamSchema = exports.OAuthLinkBodySchema = exports.OAuthCallbackQuerySchema = exports.OAuthInitQuerySchema = exports.ProviderParamSchema = void 0;
const zod_1 = require("zod");
// ── Path param: provider ──────────────────────────────────────
exports.ProviderParamSchema = zod_1.z.object({
    provider: zod_1.z.enum(['google', 'github'], {
        errorMap: () => ({
            message: "Provider tidak valid. Pilih: 'google' atau 'github'.",
        }),
    }),
});
// ── Query: inisiasi OAuth ─────────────────────────────────────
exports.OAuthInitQuerySchema = zod_1.z.object({
    appClientId: zod_1.z.string().min(1, 'appClientId wajib diisi.'),
    // redirectUri opsional — URL frontend setelah OAuth selesai
    // (bukan OAuth callback URI, tapi redirect setelah kita proses di backend)
    redirectUri: zod_1.z.string().url('redirectUri harus berupa URL yang valid.').optional(),
});
// ── Query: OAuth callback ─────────────────────────────────────
exports.OAuthCallbackQuerySchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Authorization code tidak boleh kosong.'),
    state: zod_1.z.string().min(1, 'State tidak boleh kosong.'),
    // Error fields dari provider (jika user deny atau ada error)
    error: zod_1.z.string().optional(),
    error_description: zod_1.z.string().optional(),
});
// ── Body: link OAuth ke existing user ─────────────────────────
exports.OAuthLinkBodySchema = zod_1.z.object({
    provider: zod_1.z.enum(['google', 'github'], {
        errorMap: () => ({ message: "Provider tidak valid. Pilih: 'google' atau 'github'." }),
    }),
    redirectUri: zod_1.z
        .string()
        .url('redirectUri harus berupa URL yang valid.')
        .optional(),
});
// ── Path param: provider untuk unlink ────────────────────────
exports.OAuthUnlinkParamSchema = zod_1.z.object({
    provider: zod_1.z.enum(['google', 'github'], {
        errorMap: () => ({ message: "Provider tidak valid. Pilih: 'google' atau 'github'." }),
    }),
});
//# sourceMappingURL=oauth.schema.js.map