import type { JwtAccessPayload, JwtRefreshPayload, JwtPayload } from '../types';
export declare function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds: number): string;
export declare function verifyJwt(token: string): JwtPayload;
export declare function signAccessToken(data: Omit<JwtAccessPayload, 'type' | 'iat' | 'exp'>): string;
export declare function signRefreshToken(data: Omit<JwtRefreshPayload, 'type' | 'iat' | 'exp'>): string;
export declare function verifyAccessToken(token: string): JwtAccessPayload;
export declare function verifyRefreshToken(token: string): JwtRefreshPayload;
export declare function extractBearerToken(authHeader: string | undefined): string | null;
