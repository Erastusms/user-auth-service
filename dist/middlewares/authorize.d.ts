import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function requireAuth(request: FastifyRequest, _reply: FastifyReply): void;
export declare function authorize(...requiredPermissions: string[]): (request: FastifyRequest, _reply: FastifyReply) => void;
export declare function requireRole(...requiredRoles: string[]): (request: FastifyRequest, _reply: FastifyReply) => void;
export declare function requireSelfOrAdmin(paramName?: string): (request: FastifyRequest, _reply: FastifyReply) => void;
