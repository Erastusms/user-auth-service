import type { FastifyRequest, FastifyReply } from 'fastify';
import type { OAuthInitQuery, OAuthCallbackQuery, OAuthLinkBody, OAuthUnlinkParam } from './oauth.schema';
export declare function initiateOAuthHandler(request: FastifyRequest<{
    Params: {
        provider: string;
    };
    Querystring: OAuthInitQuery;
}>, reply: FastifyReply): Promise<void>;
export declare function oauthCallbackHandler(request: FastifyRequest<{
    Params: {
        provider: string;
    };
    Querystring: OAuthCallbackQuery;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function linkOAuthHandler(request: FastifyRequest<{
    Body: OAuthLinkBody;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function unlinkOAuthHandler(request: FastifyRequest<{
    Params: OAuthUnlinkParam;
}>, reply: FastifyReply): Promise<FastifyReply>;
export declare function getLinkedProvidersHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
