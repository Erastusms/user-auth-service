import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
export interface RequestSchema {
    body?: ZodTypeAny;
    params?: ZodTypeAny;
    query?: ZodTypeAny;
    headers?: ZodTypeAny;
}
export declare function validate(schema: RequestSchema): (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => void;
export declare const IdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    sort: z.ZodOptional<z.ZodString>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    order: "asc" | "desc";
    sort?: string | undefined;
    search?: string | undefined;
}, {
    sort?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export declare const UuidSchema: z.ZodString;
export declare const EmailSchema: z.ZodString;
export declare const PasswordSchema: z.ZodString;
