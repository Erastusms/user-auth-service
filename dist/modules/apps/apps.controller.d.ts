import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterAppDto } from './apps.schema';
export declare function registerAppHandler(request: FastifyRequest<{
    Body: RegisterAppDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
