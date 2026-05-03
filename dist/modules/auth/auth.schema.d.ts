import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    appClientId: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    locale: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    locale: string;
    appClientId: string;
    username?: string | undefined;
    displayName?: string | undefined;
}, {
    password: string;
    email: string;
    appClientId: string;
    username?: string | undefined;
    locale?: string | undefined;
    displayName?: string | undefined;
}>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    appClientId: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    deviceName: z.ZodEffects<z.ZodOptional<z.ZodString>, string, string | undefined>;
    deviceType: z.ZodDefault<z.ZodEnum<["browser", "mobile", "desktop", "api"]>>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    appClientId: string;
    deviceName: string;
    deviceType: "browser" | "mobile" | "desktop" | "api";
}, {
    password: string;
    email: string;
    appClientId: string;
    deviceName?: string | undefined;
    deviceType?: "browser" | "mobile" | "desktop" | "api" | undefined;
}>;
export type LoginDto = z.infer<typeof LoginSchema>;
export declare const LogoutSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type LogoutDto = z.infer<typeof LogoutSchema>;
export declare const RefreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
    appClientId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
    appClientId: string;
}, {
    refreshToken: string;
    appClientId: string;
}>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
export declare const RevokeAllSchema: z.ZodObject<{
    exceptCurrentSession: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    exceptCurrentSession: boolean;
}, {
    exceptCurrentSession?: boolean | undefined;
}>;
export type RevokeAllDto = z.infer<typeof RevokeAllSchema>;
