// ── Result types ─────────────────────────────────────────────
export interface SendVerificationResult {
  message: string;
}

export interface VerifyEmailResult {
  message: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}

export interface ForgotPasswordResult {
  message: string;
}

export interface ResetPasswordResult {
  message: string;
  revokedSessions: number;
}

export interface ChangePasswordResult {
  message: string;
}

// ── DB row shapes ─────────────────────────────────────────────
export interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  is_active: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  deleted_at: Date | null;
  email_verified_at: Date | null;
}

export interface PasswordRow {
  id: string;
  user_id: string;
  password_hash: string;
  previous_hashes: unknown;
  must_change: boolean;
}

export interface VerificationTokenRow {
  id: string;
  user_id: string;
  type: string;
  token_hash: string;
  target: string;
  expires_at: Date;
  used_at: Date | null;
}
