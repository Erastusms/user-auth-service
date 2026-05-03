import type { FastifyInstance } from 'fastify';
export declare const helmetPlugin: (app: FastifyInstance) => Promise<void>;
export declare const corsPlugin: (app: FastifyInstance) => Promise<void>;
export declare const rateLimitPlugin: (app: FastifyInstance) => Promise<void>;
export declare const authRateLimitConfig: {
    max: number;
    timeWindow: number;
    keyGenerator: (request: {
        headers: Record<string, string | undefined>;
        ip: string;
    }) => string;
};
