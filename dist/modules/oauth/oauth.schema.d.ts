import { z } from 'zod';
export declare const ProviderParamSchema: z.ZodObject<{
    provider: z.ZodEnum<["google", "github"]>;
}, "strip", z.ZodTypeAny, {
    provider: "google" | "github";
}, {
    provider: "google" | "github";
}>;
export declare const OAuthInitQuerySchema: z.ZodObject<{
    appClientId: z.ZodString;
    redirectUri: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    appClientId: string;
    redirectUri?: string | undefined;
}, {
    appClientId: string;
    redirectUri?: string | undefined;
}>;
export type OAuthInitQuery = z.infer<typeof OAuthInitQuerySchema>;
export declare const OAuthCallbackQuerySchema: z.ZodObject<{
    code: z.ZodString;
    state: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
    error_description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    state: string;
    error?: string | undefined;
    error_description?: string | undefined;
}, {
    code: string;
    state: string;
    error?: string | undefined;
    error_description?: string | undefined;
}>;
export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>;
export declare const OAuthLinkBodySchema: z.ZodObject<{
    provider: z.ZodEnum<["google", "github"]>;
    redirectUri: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: "google" | "github";
    redirectUri?: string | undefined;
}, {
    provider: "google" | "github";
    redirectUri?: string | undefined;
}>;
export type OAuthLinkBody = z.infer<typeof OAuthLinkBodySchema>;
export declare const OAuthUnlinkParamSchema: z.ZodObject<{
    provider: z.ZodEnum<["google", "github"]>;
}, "strip", z.ZodTypeAny, {
    provider: "google" | "github";
}, {
    provider: "google" | "github";
}>;
export type OAuthUnlinkParam = z.infer<typeof OAuthUnlinkParamSchema>;
