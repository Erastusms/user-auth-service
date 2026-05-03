"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.createdResponse = createdResponse;
exports.paginatedResponse = paginatedResponse;
exports.noContentResponse = noContentResponse;
exports.errorResponse = errorResponse;
exports.parsePagination = parsePagination;
const uuid_1 = require("uuid");
const errors_1 = require("./errors");
function buildMeta(requestId) {
    return {
        timestamp: new Date().toISOString(),
        requestId: requestId ?? (0, uuid_1.v4)(),
    };
}
function successResponse(reply, data, statusCode = 200) {
    const body = {
        success: true,
        data,
        meta: buildMeta(reply.request.id),
    };
    return reply.status(statusCode).send(body);
}
function createdResponse(reply, data) {
    return successResponse(reply, data, 201);
}
function paginatedResponse(reply, data, pagination) {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);
    const body = {
        success: true,
        data,
        meta: {
            ...buildMeta(reply.request.id),
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
    return reply.status(200).send(body);
}
function noContentResponse(reply) {
    return reply.status(204).send();
}
function errorResponse(reply, error) {
    let errorBody;
    if (error instanceof errors_1.ValidationError) {
        errorBody = { code: error.code, message: error.message, details: error.fields };
    }
    else if (error instanceof errors_1.MfaRequiredError) {
        errorBody = error.toJSON();
    }
    else {
        errorBody = {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
        };
    }
    const body = {
        success: false,
        error: errorBody,
        meta: buildMeta(reply.request.id),
    };
    return reply.status(error.statusCode).send(body);
}
function parsePagination(query) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
//# sourceMappingURL=response.js.map