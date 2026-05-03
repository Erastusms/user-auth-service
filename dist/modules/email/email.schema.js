"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.VerifyEmailSchema = exports.SendVerificationSchema = void 0;
const zod_1 = require("zod");
const validate_1 = require("../../middlewares/validate");
// ── Send Verification Email ───────────────────────────────────
exports.SendVerificationSchema = zod_1.z.object({
    email: validate_1.EmailSchema,
});
// ── Verify Email ──────────────────────────────────────────────
exports.VerifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token wajib diisi.'),
});
// ── Forgot Password ───────────────────────────────────────────
exports.ForgotPasswordSchema = zod_1.z.object({
    email: validate_1.EmailSchema,
    appClientId: zod_1.z.string().min(1, 'appClientId wajib diisi.'),
});
// ── Reset Password ────────────────────────────────────────────
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token wajib diisi.'),
    newPassword: validate_1.PasswordSchema,
});
// ── Change Password (authenticated) ──────────────────────────
exports.ChangePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, 'Password saat ini wajib diisi.'),
    newPassword: validate_1.PasswordSchema,
    revokeOtherSessions: zod_1.z.boolean().default(true),
})
    .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Password baru tidak boleh sama dengan password saat ini.',
    path: ['newPassword'],
});
//# sourceMappingURL=email.schema.js.map