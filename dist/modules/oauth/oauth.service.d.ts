import type { OAuthCallbackResult, OAuthLinkInitResult, OAuthUnlinkResult } from './oauth.types';
import type { OAuthInitQuery, OAuthCallbackQuery, OAuthLinkBody, OAuthUnlinkParam } from './oauth.schema';
export declare function initiateOAuth(provider: string, query: OAuthInitQuery, meta: {
    ip: string;
    existingUserId?: string;
}): Promise<string>;
export declare function handleOAuthCallback(provider: string, query: OAuthCallbackQuery, meta: {
    ip: string;
    userAgent: string;
}): Promise<OAuthCallbackResult>;
export declare function initiateLinkOAuth(body: OAuthLinkBody, userId: string, appClientId: string, meta: {
    ip: string;
}): Promise<OAuthLinkInitResult>;
export declare function unlinkOAuth(param: OAuthUnlinkParam, userId: string, meta: {
    ip: string;
    userAgent: string;
}): Promise<OAuthUnlinkResult>;
export declare function getLinkedProviders(userId: string): Promise<{
    provider: string;
    email: string | null;
    linkedAt: Date;
}[]>;
