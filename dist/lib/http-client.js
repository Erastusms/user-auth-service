"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpRequest = httpRequest;
exports.httpGet = httpGet;
exports.httpPost = httpPost;
exports.httpPostForm = httpPostForm;
/**
 * Lightweight HTTP client berbasis Node.js built-in https/http.
 * Digunakan untuk OAuth token exchange & userinfo requests.
 * Tidak pakai axios ataupun library HTTP eksternal lainnya.
 */
const node_https_1 = __importDefault(require("node:https"));
const node_http_1 = __importDefault(require("node:http"));
const node_url_1 = require("node:url");
const logger_1 = require("./logger");
const log = (0, logger_1.createLogger)('http-client');
// ── Core Request ──────────────────────────────────────────────
function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new node_url_1.URL(url);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? node_https_1.default : node_http_1.default;
        const reqOptions = {
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
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const rawBody = Buffer.concat(chunks).toString('utf-8');
                const contentType = res.headers['content-type'] ?? '';
                let parsedBody;
                try {
                    parsedBody = contentType.includes('application/json')
                        ? JSON.parse(rawBody)
                        : rawBody;
                }
                catch {
                    parsedBody = rawBody;
                }
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers,
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
function httpGet(url, headers) {
    return httpRequest(url, { method: 'GET', headers });
}
function httpPost(url, body, headers) {
    return httpRequest(url, { method: 'POST', body, headers });
}
// ── Form-encoded POST (dipakai untuk OAuth token exchange) ────
function httpPostForm(url, params, headers) {
    const body = new URLSearchParams(params).toString();
    return httpRequest(url, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...headers,
        },
    });
}
//# sourceMappingURL=http-client.js.map