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
exports.registerHandler = registerHandler;
exports.loginHandler = loginHandler;
exports.logoutHandler = logoutHandler;
exports.refreshHandler = refreshHandler;
exports.revokeAllHandler = revokeAllHandler;
const response_1 = require("../../shared/response");
const authService = __importStar(require("./auth.service"));
// ── Helper: extract request metadata ─────────────────────────
function getRequestMeta(request) {
    return {
        ip: request.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            request.ip ??
            '0.0.0.0',
        userAgent: request.headers['user-agent'] ?? 'unknown',
        deviceName: undefined, // akan di-override dari body jika ada
        deviceType: undefined,
    };
}
// ── POST /auth/register ───────────────────────────────────────
async function registerHandler(request, reply) {
    const result = await authService.register(request.body, getRequestMeta(request));
    return (0, response_1.createdResponse)(reply, result);
}
// ── POST /auth/login ──────────────────────────────────────────
async function loginHandler(request, reply) {
    const meta = {
        ...getRequestMeta(request),
        deviceName: request.body.deviceName,
        deviceType: request.body.deviceType,
    };
    const result = await authService.login(request.body, meta);
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/logout ─────────────────────────────────────────
async function logoutHandler(request, reply) {
    // authUser di-set oleh middleware authenticate
    const { id: userId, sessionId } = request.authUser;
    await authService.logout(request.body, userId, sessionId, getRequestMeta(request));
    return (0, response_1.successResponse)(reply, { message: 'Logout berhasil.' });
}
// ── POST /auth/refresh ────────────────────────────────────────
async function refreshHandler(request, reply) {
    const result = await authService.refresh(request.body);
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/revoke-all ─────────────────────────────────────
async function revokeAllHandler(request, reply) {
    const { id: userId, sessionId } = request.authUser;
    const result = await authService.revokeAll(request.body, userId, sessionId, getRequestMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
//# sourceMappingURL=auth.controller.js.map