import type { RegisterDto, LoginDto, LogoutDto, RefreshDto, RevokeAllDto } from './auth.schema';
import type { RequestMeta, RegisterResult, LoginResult, RefreshResult, RevokeAllResult } from './auth.types';
export declare function register(dto: RegisterDto, meta: RequestMeta): Promise<RegisterResult>;
export declare function login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult>;
export declare function logout(dto: LogoutDto, userId: string, sessionId: string, meta: RequestMeta): Promise<void>;
export declare function refresh(dto: RefreshDto): Promise<RefreshResult>;
export declare function revokeAll(dto: RevokeAllDto, userId: string, currentSessionId: string, meta: RequestMeta): Promise<RevokeAllResult>;
