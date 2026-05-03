import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterDto, LoginDto, LogoutDto, RefreshDto, RevokeAllDto } from './auth.schema';
export declare function registerHandler(request: FastifyRequest<{
    Body: RegisterDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function loginHandler(request: FastifyRequest<{
    Body: LoginDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function logoutHandler(request: FastifyRequest<{
    Body: LogoutDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function refreshHandler(request: FastifyRequest<{
    Body: RefreshDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function revokeAllHandler(request: FastifyRequest<{
    Body: RevokeAllDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
