import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SendVerificationDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './email.schema';
export declare function sendVerificationHandler(request: FastifyRequest<{
    Body: SendVerificationDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function verifyEmailHandler(request: FastifyRequest<{
    Body: VerifyEmailDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function forgotPasswordHandler(request: FastifyRequest<{
    Body: ForgotPasswordDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function resetPasswordHandler(request: FastifyRequest<{
    Body: ResetPasswordDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function changePasswordHandler(request: FastifyRequest<{
    Body: ChangePasswordDto;
}>, reply: FastifyReply): Promise<FastifyReply>;
