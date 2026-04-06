# User & Auth Service

Layanan autentikasi dan manajemen user terpusat yang dapat dipakai oleh banyak proyek (multi-app). Dibangun dengan **Fastify**, **TypeScript**, **Prisma**, dan **PostgreSQL**.

## Fitur

- **Auth Core** — Register, Login, Logout, Refresh Token (dengan rotation)
- **OAuth 2.0** — Google, GitHub, Microsoft (PKCE flow)
- **Email Verification** — Token sekali pakai berbasis SHA-256
- **Password Management** — Reset, Change, History enforcement
- **MFA** — TOTP (Google Authenticator), Backup Codes, WebAuthn
- **Session Management** — Multi-device, revoke per device
- **Multi-App Registry** — Satu service untuk banyak proyek
- **RBAC** — Role global & per-app, role hierarchy, fine-grained permissions
- **Audit Logs** — Immutable security audit trail

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Fastify 4.x |
| Language | TypeScript 5.x |
| ORM | Prisma 5.x |
| Database | PostgreSQL 14+ |
| Validation | Zod 3.x |
| Logger | Pino |
| Testing | Vitest |
| Auth | JWT (HS256/RS256) |
| MFA | speakeasy (TOTP) |
| Password | bcryptjs |

---

## Struktur Proyek

```
user-auth-service/
├── src/
│   ├── app.ts                        # Fastify instance & plugin registration
│   ├── server.ts                     # Entry point + graceful shutdown
│   ├── config/
│   │   ├── env.ts                    # Zod-validated environment variables
│   │   └── constants.ts              # HTTP codes, error codes, constants
│   ├── modules/
│   │   ├── health/
│   │   │   └── health.routes.ts      # GET /health, GET /health/full
│   │   ├── auth/                     # (Phase 2)
│   │   ├── oauth/                    # (Phase 3)
│   │   ├── mfa/                      # (Phase 5)
│   │   ├── users/                    # (Phase 7)
│   │   ├── apps/                     # (Phase 8)
│   │   ├── roles/                    # (Phase 8)
│   │   ├── permissions/              # (Phase 8)
│   │   └── sessions/                 # (Phase 6)
│   ├── middlewares/
│   │   ├── validate.ts               # Zod validation hook factory
│   │   ├── authenticate.ts           # JWT + session verification
│   │   └── authorize.ts              # RBAC permission/role checks
│   ├── plugins/
│   │   ├── security.ts               # Helmet, CORS, Rate Limiter
│   │   ├── errorHandler.ts           # Global error handler
│   │   └── request.ts                # Request ID + HTTP logging
│   ├── lib/
│   │   ├── jwt.ts                    # JWT sign/verify (RS256 & HS256)
│   │   ├── crypto.ts                 # AES-256-GCM, bcrypt, token generators
│   │   ├── logger.ts                 # Pino logger + child logger factory
│   │   └── prisma.ts                 # Prisma singleton client
│   ├── shared/
│   │   ├── errors.ts                 # Custom error classes
│   │   └── response.ts               # Standard API response builders
│   └── types/
│       └── index.ts                  # TypeScript types + Fastify augmentation
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── seed.ts                       # Seed data (default app, roles, admin user)
├── tests/
│   ├── setup.ts                      # Vitest global setup + mock Prisma
│   ├── unit/
│   │   ├── jwt.test.ts
│   │   └── crypto.test.ts
│   └── integration/
│       └── app.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Setup & Instalasi

### Prerequisites

- Node.js v20 atau lebih baru
- PostgreSQL 14+ sudah berjalan
- Database `user_multi_app` sudah dibuat dengan schema dari file `user_auth_schema.sql`

### Langkah 1 — Clone & Install Dependencies

```bash
git clone <your-repo-url> user-auth-service
cd user-auth-service
npm install
```

### Langkah 2 — Setup Environment Variables

```bash
# Salin template
cp .env.example .env

# Edit dengan editor favoritmu
nano .env   # atau: code .env / vim .env
```

Bagian yang **wajib** diisi minimal untuk development:

```env
# Database — sesuaikan user, password, dan nama DB kamu
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/user_multi_app?schema=public"

# JWT Secret — generate dengan perintah di bawah
JWT_SECRET="<hasil generate>"

# Encryption Key — WAJIB 64 karakter hex (32 bytes)
ENCRYPTION_KEY="<hasil generate>"
```

**Generate JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Generate ENCRYPTION_KEY:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Langkah 3 — Setup Prisma

**Jika database sudah ada** (sudah jalankan `user_auth_schema.sql`):

```bash
# Generate Prisma client dari schema yang ada
npm run db:generate

# Introspect (opsional — untuk sinkronisasi schema.prisma dengan DB yang sudah ada)
npx prisma db pull
```

**Jika dari nol** (belum ada tabel):

```bash
# Jalankan SQL schema dulu di DBeaver/psql:
# File: user_auth_schema.sql

# Lalu generate Prisma client
npm run db:generate
```

### Langkah 4 — Seed Data

```bash
npm run db:seed
```

Output yang diharapkan:

```
🌱 Starting seed...
✅ App: Default App (client_id: ci_abc123...)
✅ Global roles created: super_admin, system
✅ Role created: owner (app: default)
✅ Role created: admin (app: default)
✅ Role created: member (app: default)
✅ Role created: viewer (app: default)
✅ 9 permissions created
✅ Permissions assigned to role: owner
...
✅ Super admin user created: admin@example.com / Admin123!
   ⚠️  GANTI PASSWORD INI SEBELUM DEPLOY KE PRODUCTION!

✅ Seed completed successfully!

📋 Summary:
   App client_id: ci_abc123def456...
   App client_secret: cs_xyz789...
   ⚠️  Simpan client_secret di atas untuk testing!
```

**Simpan `client_id` dan `client_secret` dari output di atas** — akan dibutuhkan untuk testing API.

### Langkah 5 — Jalankan Server

```bash
# Development (hot reload dengan tsx watch)
npm run dev

# Output yang diharapkan:
# ✅ Database connected
# [2025-01-15 10:30:00] INFO: App ready
# [2025-01-15 10:30:00] INFO: Server running at http://0.0.0.0:3000
```

### Langkah 6 — Verifikasi

```bash
# Health check
curl http://localhost:3000/health

# Expected:
# {"status":"ok","timestamp":"2025-01-15T10:30:00.000Z"}

# Full health check (cek DB)
curl http://localhost:3000/health/full

# Expected:
# {"status":"ok","timestamp":"...","uptime":5.2,"version":"1.0.0","services":{"database":"ok"}}
```

---

## Konfigurasi JWT

### HS256 (Symmetric) — Default untuk Development

Satu secret digunakan untuk sign dan verify. Lebih sederhana tapi less secure karena siapa saja yang punya secret bisa buat token.

```env
JWT_ALGORITHM=HS256
JWT_SECRET="your-64-char-hex-secret"
```

### RS256 (Asymmetric) — Recommended untuk Production

Private key untuk sign (di auth service), public key untuk verify (di service lain). Service lain cukup dapat public key, tidak perlu tahu private key.

**Generate RSA Key Pair:**

```bash
# Generate private key (2048-bit)
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Encode ke base64 untuk .env (tanpa newlines)
# Linux/Mac:
cat private.pem | base64 -w 0
cat public.pem  | base64 -w 0

# Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("private.pem"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("public.pem"))
```

**Set di .env:**

```env
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY="base64_encoded_private_key_here"
JWT_PUBLIC_KEY="base64_encoded_public_key_here"
```

> ⚠️ **JANGAN commit file .pem ke git!** File sudah ada di `.gitignore`.

---

## Konfigurasi OAuth

### Google

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru atau pilih project yang ada
3. Aktifkan **Google+ API** (atau **Google Identity**)
4. Buka **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:3000/v1/auth/oauth/google/callback`
7. Salin **Client ID** dan **Client Secret**

```env
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/v1/auth/oauth/google/callback"
```

### GitHub

1. Buka [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/applications/new)
2. **Application name**: Auth Service
3. **Homepage URL**: `http://localhost:3000`
4. **Authorization callback URL**: `http://localhost:3000/v1/auth/oauth/github/callback`
5. Generate **Client Secret**

```env
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_REDIRECT_URI="http://localhost:3000/v1/auth/oauth/github/callback"
```

---

## Konfigurasi Email

### Development — Mailtrap (Recommended)

[Mailtrap](https://mailtrap.io) adalah email sandbox gratis untuk development. Email "dikirim" ke inbox Mailtrap tanpa benar-benar terkirim ke user.

1. Daftar di mailtrap.io (gratis)
2. Buka **Inboxes** → pilih inbox → **SMTP Settings**
3. Salin credentials ke `.env`:

```env
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER="your-mailtrap-user"
SMTP_PASS="your-mailtrap-password"
EMAIL_FROM="noreply@yourdomain.com"
```

### Production — Resend (Recommended)

[Resend](https://resend.com) adalah email API modern yang mudah digunakan.

```env
SMTP_HOST="smtp.resend.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="resend"
SMTP_PASS="your-resend-api-key"
EMAIL_FROM="noreply@yourdomain.com"
```

---

## Rate Limiting

Rate limit dikonfigurasi di `.env` dan dapat di-override per-route:

```env
# Global rate limit
RATE_LIMIT_MAX=100          # 100 request per menit per IP
RATE_LIMIT_WINDOW_MS=60000

# Auth endpoints (lebih ketat)
RATE_LIMIT_AUTH_MAX=10       # 10 request per menit per IP
RATE_LIMIT_AUTH_WINDOW_MS=60000
```

**Override per-route** (contoh di route handler):

```typescript
fastify.post('/login', {
  config: { rateLimit: authRateLimitConfig },
}, handler);
```

---

## Cara Pakai Middleware di Route

### Authenticate (verifikasi JWT)

```typescript
import { authenticate } from '@/middlewares/authenticate';

fastify.get('/protected', {
  preHandler: [authenticate],
}, async (request, reply) => {
  const user = request.authUser!; // Dijamin ada setelah authenticate
  return { userId: user.id };
});
```

### Authorize (cek permission)

```typescript
import { authenticate } from '@/middlewares/authenticate';
import { authorize, requireRole, requireSelfOrAdmin } from '@/middlewares/authorize';

// Cek permission spesifik
fastify.get('/users', {
  preHandler: [authenticate, authorize('users:read')],
}, handler);

// Cek role
fastify.delete('/users/:id', {
  preHandler: [authenticate, requireRole('admin', 'super_admin')],
}, handler);

// Self atau admin (user bisa akses data diri sendiri, admin bisa akses semua)
fastify.get('/users/:id', {
  preHandler: [authenticate, requireSelfOrAdmin('id')],
}, handler);
```

### Validate (Zod schema)

```typescript
import { validate } from '@/middlewares/validate';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

fastify.post('/register', {
  preHandler: [validate({ body: RegisterSchema })],
}, async (request, reply) => {
  const { email, password, displayName } = request.body as z.infer<typeof RegisterSchema>;
  // ...
});
```

---

## Response Format

Semua endpoint menggunakan format response yang konsisten:

```typescript
import { successResponse, createdResponse, paginatedResponse } from '@/shared/response';

// Success
return successResponse(reply, { user });

// Created (201)
return createdResponse(reply, { user });

// Paginated list
return paginatedResponse(reply, users, { page: 1, limit: 20, total: 150 });
```

---

## Testing

```bash
# Jalankan semua test
npm test

# Watch mode (untuk development)
npm run test:watch

# Dengan coverage report
npm run test:coverage
```

### Test Structure

```
tests/
├── setup.ts          # Mock Prisma, set env variables
├── unit/
│   ├── jwt.test.ts   # Test JWT sign/verify
│   └── crypto.test.ts # Test hashing & encryption
└── integration/
    └── app.test.ts   # Test HTTP endpoints dengan app.inject()
```

---

## Scripts

| Script | Keterangan |
|---|---|
| `npm run dev` | Jalankan server development dengan hot reload |
| `npm run build` | Compile TypeScript ke JavaScript |
| `npm start` | Jalankan server production (butuh `build` dulu) |
| `npm run db:generate` | Generate Prisma client dari schema |
| `npm run db:migrate` | Buat dan jalankan migration baru |
| `npm run db:migrate:prod` | Deploy migration ke production |
| `npm run db:studio` | Buka Prisma Studio (GUI database) |
| `npm run db:seed` | Jalankan seed data |
| `npm run db:reset` | Reset database (DROP + migrate + seed) |
| `npm test` | Jalankan semua test |
| `npm run test:coverage` | Test dengan coverage report |
| `npm run lint` | TypeScript type checking |

---

## Environment Variables Reference

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `NODE_ENV` | | `development` | `development`, `production`, `test` |
| `PORT` | | `3000` | Port server |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_ALGORITHM` | | `HS256` | `HS256` atau `RS256` |
| `JWT_SECRET` | ✅ (HS256) | — | Minimal 64 chars |
| `JWT_PRIVATE_KEY` | ✅ (RS256) | — | Base64 encoded PEM |
| `JWT_PUBLIC_KEY` | ✅ (RS256) | — | Base64 encoded PEM |
| `ENCRYPTION_KEY` | ✅ | — | Tepat 64 hex chars (32 bytes) |
| `CORS_ALLOWED_ORIGINS` | | `http://localhost:3001` | Comma-separated |
| `RATE_LIMIT_MAX` | | `100` | Per IP per window |
| `SMTP_HOST` | | `smtp.mailtrap.io` | SMTP server |
| `GOOGLE_CLIENT_ID` | | — | Untuk Google OAuth |
| `GITHUB_CLIENT_ID` | | — | Untuk GitHub OAuth |

Lihat `.env.example` untuk daftar lengkap.

---

## Development Roadmap

| Phase | Status | Keterangan |
|---|---|---|
| Phase 1 — Project Setup | ✅ Done | Fastify, TypeScript, Prisma, JWT, Logger, Security |
| Phase 2 — Auth Core | 🔄 Next | Register, Login, Refresh Token |
| Phase 3 — OAuth | ⏳ | Google, GitHub, PKCE |
| Phase 4 — Email & Password | ⏳ | Verification, Reset, Magic Link |
| Phase 5 — MFA | ⏳ | TOTP, Backup Codes |
| Phase 6 — Sessions | ⏳ | Multi-device management |
| Phase 7 — User Management | ⏳ | Profile, Admin CRUD |
| Phase 8 — Apps, Roles, Permissions | ⏳ | RBAC full implementation |
| Phase 9 — Testing & Hardening | ⏳ | Integration tests, load testing |

---

## Keamanan

Beberapa keputusan keamanan yang perlu diketahui:

- **Refresh Token Rotation** — Setiap pakai refresh token, token baru dibuat dan yang lama direvoke. Reuse = revoke seluruh family.
- **Token Hashing** — Semua token (verification, refresh) hanya disimpan sebagai SHA-256 hash di DB. Token asli hanya ada di response/email.
- **AES-256-GCM** — OAuth provider tokens dan TOTP secrets dienkripsi sebelum disimpan di DB.
- **Timing-Safe Comparison** — Semua perbandingan string sensitif menggunakan `crypto.timingSafeEqual`.
- **Immutable Audit Logs** — Tidak ada UPDATE/DELETE pada tabel `audit_logs`.
- **PKCE** — OAuth flow menggunakan PKCE (code verifier + code challenge) untuk keamanan extra.
- **bcrypt (cost=12)** — Password di-hash dengan bcrypt cost factor 12.

---

## License

MIT
