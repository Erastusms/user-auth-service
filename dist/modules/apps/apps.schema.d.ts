import { z } from 'zod';
export declare const RegisterAppSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    allowedCallbackUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    allowedLogoutUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    allowedOrigins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    allowedWebOrigins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    accessTokenTtl: z.ZodDefault<z.ZodNumber>;
    refreshTokenTtl: z.ZodDefault<z.ZodNumber>;
    roles: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        slug: string;
        description?: string | undefined;
    }, {
        name: string;
        slug: string;
        description?: string | undefined;
    }>, "many">>;
    adminEmail: z.ZodString;
    adminPassword: z.ZodString;
    adminDisplayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roles: {
        name: string;
        slug: string;
        description?: string | undefined;
    }[];
    name: string;
    slug: string;
    allowedCallbackUrls: string[];
    allowedLogoutUrls: string[];
    allowedOrigins: string[];
    allowedWebOrigins: string[];
    accessTokenTtl: number;
    refreshTokenTtl: number;
    adminEmail: string;
    adminPassword: string;
    description?: string | undefined;
    adminDisplayName?: string | undefined;
}, {
    name: string;
    slug: string;
    adminEmail: string;
    adminPassword: string;
    roles?: {
        name: string;
        slug: string;
        description?: string | undefined;
    }[] | undefined;
    description?: string | undefined;
    allowedCallbackUrls?: string[] | undefined;
    allowedLogoutUrls?: string[] | undefined;
    allowedOrigins?: string[] | undefined;
    allowedWebOrigins?: string[] | undefined;
    accessTokenTtl?: number | undefined;
    refreshTokenTtl?: number | undefined;
    adminDisplayName?: string | undefined;
}>;
export type RegisterAppDto = z.infer<typeof RegisterAppSchema>;
