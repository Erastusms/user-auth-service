import { z } from 'zod';
export declare const SendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type SendVerificationDto = z.infer<typeof SendVerificationSchema>;
export declare const VerifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    appClientId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    appClientId: string;
}, {
    email: string;
    appClientId: string;
}>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
    token: string;
}, {
    newPassword: string;
    token: string;
}>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export declare const ChangePasswordSchema: z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    revokeOtherSessions: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
}, {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean | undefined;
}>, {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
}, {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean | undefined;
}>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
