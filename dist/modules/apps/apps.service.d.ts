import type { RegisterAppDto } from './apps.schema';
import type { RegisterAppResult } from './apps.types';
export declare function registerApp(dto: RegisterAppDto, meta: {
    ip: string;
    userAgent: string;
}): Promise<RegisterAppResult>;
