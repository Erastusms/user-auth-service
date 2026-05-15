"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterAppSchema = void 0;
const zod_1 = require("zod");
const validate_1 = require("../../middlewares/validate");
// ── Role Input Schema ─────────────────────────────────────────
const RoleInputSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Nama role tidak boleh kosong.')
        .max(100, 'Nama role maksimal 100 karakter.'),
    slug: zod_1.z
        .string()
        .min(1, 'Slug role tidak boleh kosong.')
        .max(100, 'Slug role maksimal 100 karakter.')
        .regex(/^[a-z0-9_-]+$/, 'Slug role hanya boleh berisi huruf kecil, angka, underscore (_), dan dash (-).'),
    description: zod_1.z
        .string()
        .max(500, 'Deskripsi role maksimal 500 karakter.')
        .optional(),
});
// ── Register App Schema ───────────────────────────────────────
exports.RegisterAppSchema = zod_1.z.object({
    // ── Info Aplikasi ─────────────────────────────────────────
    name: zod_1.z
        .string()
        .min(1, 'Nama aplikasi tidak boleh kosong.')
        .max(100, 'Nama aplikasi maksimal 100 karakter.'),
    slug: zod_1.z
        .string()
        .min(2, 'Slug minimal 2 karakter.')
        .max(50, 'Slug maksimal 50 karakter.')
        .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh berisi huruf kecil, angka, dan dash (-).'),
    description: zod_1.z
        .string()
        .max(1000, 'Deskripsi maksimal 1000 karakter.')
        .optional(),
    // ── Konfigurasi URL ───────────────────────────────────────
    allowedCallbackUrls: zod_1.z
        .array(zod_1.z.string().url('Format URL callback tidak valid.'))
        .max(20, 'Maksimal 20 callback URL.')
        .default([]),
    allowedLogoutUrls: zod_1.z
        .array(zod_1.z.string().url('Format URL logout tidak valid.'))
        .max(20, 'Maksimal 20 logout URL.')
        .default([]),
    allowedOrigins: zod_1.z
        .array(zod_1.z.string().url('Format origin tidak valid.'))
        .max(20, 'Maksimal 20 allowed origin.')
        .default([]),
    allowedWebOrigins: zod_1.z
        .array(zod_1.z.string().url('Format web origin tidak valid.'))
        .max(20, 'Maksimal 20 allowed web origin.')
        .default([]),
    // ── Konfigurasi Token TTL ─────────────────────────────────
    accessTokenTtl: zod_1.z
        .number()
        .int('TTL harus bilangan bulat.')
        .min(60, 'Access token TTL minimal 60 detik.')
        .max(86400, 'Access token TTL maksimal 86400 detik (24 jam).')
        .default(900), // 15 menit
    refreshTokenTtl: zod_1.z
        .number()
        .int('TTL harus bilangan bulat.')
        .min(3600, 'Refresh token TTL minimal 3600 detik (1 jam).')
        .max(31536000, 'Refresh token TTL maksimal 31536000 detik (1 tahun).')
        .default(2592000), // 30 hari
    // ── Role Awal ─────────────────────────────────────────────
    roles: zod_1.z
        .array(RoleInputSchema)
        .max(50, 'Maksimal 50 role per aplikasi.')
        .default([]),
    // ── Data Admin / Pendaftar ────────────────────────────────
    adminEmail: validate_1.EmailSchema,
    adminPassword: validate_1.PasswordSchema,
    adminDisplayName: zod_1.z
        .string()
        .min(1, 'Display name tidak boleh kosong.')
        .max(150, 'Display name maksimal 150 karakter.')
        .optional(),
});
//# sourceMappingURL=apps.schema.js.map