export interface HttpResponse<T = unknown> {
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: T;
}
export interface HttpRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
}
export declare function httpRequest<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
export declare function httpGet<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
export declare function httpPost<T = unknown>(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
export declare function httpPostForm<T = unknown>(url: string, params: Record<string, string>, headers?: Record<string, string>): Promise<HttpResponse<T>>;
