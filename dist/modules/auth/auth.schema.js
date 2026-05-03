"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevokeAllSchema = exports.RefreshSchema = exports.LogoutSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
const validate_1 = require("../../middlewares/validate");
// ── Register ──────────────────────────────────────────────────
exports.RegisterSchema = zod_1.z.object({
    appClientId: zod_1.z.string().min(1, 'appClientId wajib diisi.'),
    email: validate_1.EmailSchema,
    password: validate_1.PasswordSchema,
    username: zod_1.z
        .string()
        .min(3, 'Username minimal 3 karakter.')
        .max(50, 'Username maksimal 50 karakter.')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username hanya boleh berisi huruf, angka, underscore (_), dan dash (-).')
        .toLowerCase()
        .optional(),
    displayName: zod_1.z
        .string()
        .min(1, 'Display name tidak boleh kosong.')
        .max(150, 'Display name maksimal 150 karakter.')
        .optional(),
    locale: zod_1.z.string().max(10).default('id'),
});
// ── Login ─────────────────────────────────────────────────────
exports.LoginSchema = zod_1.z.object({
    appClientId: zod_1.z.string().min(1, 'appClientId wajib diisi.'),
    email: validate_1.EmailSchema,
    password: zod_1.z.string().min(1, 'Password wajib diisi.'),
    deviceName: zod_1.z
        .string()
        .max(255)
        .optional()
        .transform((v) => v ?? 'Unknown Device'),
    deviceType: zod_1.z
        .enum(['browser', 'mobile', 'desktop', 'api'])
        .default('browser'),
});
// ── Logout ────────────────────────────────────────────────────
exports.LogoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'refreshToken wajib diisi.'),
});
// ── Refresh Token ─────────────────────────────────────────────
exports.RefreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'refreshToken wajib diisi.'),
    appClientId: zod_1.z.string().min(1, 'appClientId wajib diisi.'),
});
// ── Revoke All ────────────────────────────────────────────────
exports.RevokeAllSchema = zod_1.z.object({
    exceptCurrentSession: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=auth.schema.js.map