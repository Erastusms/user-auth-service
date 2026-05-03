"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateOAuthHandler = initiateOAuthHandler;
exports.oauthCallbackHandler = oauthCallbackHandler;
exports.linkOAuthHandler = linkOAuthHandler;
exports.unlinkOAuthHandler = unlinkOAuthHandler;
exports.getLinkedProvidersHandler = getLinkedProvidersHandler;
const response_1 = require("../../shared/response");
const oauthService = __importStar(require("./oauth.service"));
// ── Helper: extract request metadata ─────────────────────────
function getMeta(req) {
    return {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.ip ??
            '0.0.0.0',
        userAgent: req.headers['user-agent'] ?? 'unknown',
    };
}
// ── GET /auth/oauth/:provider ─────────────────────────────────
// Redirect user ke halaman login provider
async function initiateOAuthHandler(request, reply) {
    const authUrl = await oauthService.initiateOAuth(request.params.provider, request.query, {
        ip: getMeta(request).ip,
        existingUserId: request.authUser?.id, // undefined jika tidak login
    });
    // HTTP 302 redirect ke provider
    void reply.redirect(302, authUrl);
}
// ── GET /auth/oauth/:provider/callback ───────────────────────
// Callback dari provider — selesaikan flow, return tokens
async function oauthCallbackHandler(request, reply) {
    const result = await oauthService.handleOAuthCallback(request.params.provider, request.query, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/oauth/link ─────────────────────────────────────
// Initiate link OAuth ke user yang sudah login
async function linkOAuthHandler(request, reply) {
    const { id: userId } = request.authUser;
    // Ambil appClientId dari header X-App-Client-Id atau body
    const appClientId = request.headers['x-app-client-id'] ?? request.body.provider;
    const result = await oauthService.initiateLinkOAuth(request.body, userId, appClientId, { ip: getMeta(request).ip });
    return (0, response_1.successResponse)(reply, result);
}
// ── DELETE /auth/oauth/link/:provider ────────────────────────
// Putus koneksi OAuth dari akun user
async function unlinkOAuthHandler(request, reply) {
    const result = await oauthService.unlinkOAuth(request.params, request.authUser.id, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── GET /auth/oauth/providers ─────────────────────────────────
// List semua provider yang terhubung ke akun user
async function getLinkedProvidersHandler(request, reply) {
    const providers = await oauthService.getLinkedProviders(request.authUser.id);
    return (0, response_1.successResponse)(reply, { providers });
}
//# sourceMappingURL=oauth.controller.js.map