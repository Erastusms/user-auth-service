import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void>;
export declare function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
