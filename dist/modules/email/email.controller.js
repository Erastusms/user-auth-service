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
exports.sendVerificationHandler = sendVerificationHandler;
exports.verifyEmailHandler = verifyEmailHandler;
exports.forgotPasswordHandler = forgotPasswordHandler;
exports.resetPasswordHandler = resetPasswordHandler;
exports.changePasswordHandler = changePasswordHandler;
const response_1 = require("../../shared/response");
const emailService = __importStar(require("./email.service"));
function getMeta(req) {
    return {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.ip ??
            '0.0.0.0',
        userAgent: req.headers['user-agent'] ?? 'unknown',
    };
}
// ── POST /auth/email/send-verification ───────────────────────
async function sendVerificationHandler(request, reply) {
    const result = await emailService.sendEmailVerification(request.body, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/email/verify ───────────────────────────────────
async function verifyEmailHandler(request, reply) {
    const result = await emailService.verifyEmail(request.body, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/password/forgot ────────────────────────────────
async function forgotPasswordHandler(request, reply) {
    const result = await emailService.forgotPassword(request.body, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── POST /auth/password/reset ─────────────────────────────────
async function resetPasswordHandler(request, reply) {
    const result = await emailService.resetPassword(request.body, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
// ── PUT /auth/password/change ─────────────────────────────────
async function changePasswordHandler(request, reply) {
    const { id: userId, sessionId } = request.authUser;
    const result = await emailService.changePassword(request.body, userId, sessionId, getMeta(request));
    return (0, response_1.successResponse)(reply, result);
}
//# sourceMappingURL=email.controller.js.map