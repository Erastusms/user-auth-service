// ── Register App ──────────────────────────────────────────────

export interface RegisterAppRoleInput {
  name: string;
  slug: string;
  description?: string;
}

export interface RegisterAppResult {
  app: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    clientId: string;
    clientSecret: string; // hanya dikembalikan sekali saat registrasi
    accessTokenTtl: number;
    refreshTokenTtl: number;
    allowedCallbackUrls: string[];
    allowedLogoutUrls: string[];
    allowedOrigins: string[];
    allowedWebOrigins: string[];
    isActive: boolean;
    createdAt: Date;
  };
  admin: {
    id: string;
    email: string;
    displayName: string;
    isNewUser: boolean; // true jika user baru dibuat, false jika sudah ada
  };
  roles: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
  }>;
  message: string;
}

// ── DB Row shapes ─────────────────────────────────────────────

export interface AppCreatedRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  client_id: string;
  client_secret: string;
  access_token_ttl: number;
  refresh_token_ttl: number;
  allowed_callback_urls: unknown;
  allowed_logout_urls: unknown;
  allowed_origins: unknown;
  allowed_web_origins: unknown;
  is_active: boolean;
  created_at: Date;
}

export interface RoleCreatedRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
