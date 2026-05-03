import type { SendVerificationDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './email.schema';
import type { SendVerificationResult, VerifyEmailResult, ForgotPasswordResult, ResetPasswordResult, ChangePasswordResult } from './email.types';
export declare function sendEmailVerification(dto: SendVerificationDto, meta: {
    ip?: string;
    userAgent?: string;
}): Promise<SendVerificationResult>;
export declare function verifyEmail(dto: VerifyEmailDto, meta: {
    ip?: string;
    userAgent?: string;
}): Promise<VerifyEmailResult>;
export declare function forgotPassword(dto: ForgotPasswordDto, meta: {
    ip?: string;
    userAgent?: string;
}): Promise<ForgotPasswordResult>;
export declare function resetPassword(dto: ResetPasswordDto, meta: {
    ip?: string;
    userAgent?: string;
}): Promise<ResetPasswordResult>;
export declare function changePassword(dto: ChangePasswordDto, userId: string, currentSessionId: string, meta: {
    ip?: string;
    userAgent?: string;
}): Promise<ChangePasswordResult>;
