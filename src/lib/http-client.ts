/**
 * Lightweight HTTP client berbasis Node.js built-in https/http.
 * Digunakan untuk OAuth token exchange & userinfo requests.
 * Tidak pakai axios ataupun library HTTP eksternal lainnya.
 */
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { createLogger } from './logger';

const log = createLogger('http-client');

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

// ── Core Request ──────────────────────────────────────────────
export function httpRequest<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method ?? 'GET',
      headers: {
        'User-Agent': 'user-auth-service/1.0',
        ...(options.body
          ? { 'Content-Length': Buffer.byteLength(options.body).toString() }
          : {}),
        ...options.headers,
      },
      timeout: options.timeoutMs ?? 10_000,
    };

    const req = transport.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        const contentType = res.headers['content-type'] ?? '';

        let parsedBody: T;
        try {
          parsedBody = contentType.includes('application/json')
            ? (JSON.parse(rawBody) as T)
            : (rawBody as unknown as T);
        } catch {
          parsedBody = rawBody as unknown as T;
        }

        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: parsedBody,
        });
      });

      res.on('error', reject);
    });

    req.on('error', (err) => {
      log.warn({ err, url }, 'HTTP request error');
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${options.timeoutMs ?? 10_000}ms`));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ── Convenience helpers ───────────────────────────────────────
export function httpGet<T = unknown>(
  url: string,
  headers?: Record<string, string>
): Promise<HttpResponse<T>> {
  return httpRequest<T>(url, { method: 'GET', headers });
}

export function httpPost<T = unknown>(
  url: string,
  body: string,
  headers?: Record<string, string>
): Promise<HttpResponse<T>> {
  return httpRequest<T>(url, { method: 'POST', body, headers });
}

// ── Form-encoded POST (dipakai untuk OAuth token exchange) ────
export function httpPostForm<T = unknown>(
  url: string,
  params: Record<string, string>,
  headers?: Record<string, string>
): Promise<HttpResponse<T>> {
  const body = new URLSearchParams(params).toString();
  return httpRequest<T>(url, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
  });
}
