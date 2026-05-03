"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordSchema = exports.EmailSchema = exports.UuidSchema = exports.PaginationQuerySchema = exports.IdParamSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const errors_1 = require("../shared/errors");
function validateWithZod(schema, data, location) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const fields = result.error.issues.map((err) => ({
            field: `${location}.${err.path.join('.')}`,
            message: err.message,
        }));
        throw new errors_1.ValidationError(fields);
    }
    return result.data;
}
function validate(schema) {
    return function validationHook(request, _reply, done) {
        try {
            if (schema.body) {
                request.body = validateWithZod(schema.body, request.body, 'body');
            }
            if (schema.params) {
                request.params = validateWithZod(schema.params, request.params, 'params');
            }
            if (schema.query) {
                request.query = validateWithZod(schema.query, request.query, 'query');
            }
            if (schema.headers) {
                validateWithZod(schema.headers, request.headers, 'headers');
            }
            done();
        }
        catch (error) {
            done(error);
        }
    };
}
// ── Common Reusable Schemas ───────────────────────────────────
exports.IdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('ID harus berupa UUID yang valid.'),
});
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100, 'Limit maksimal 100.').default(20),
    search: zod_1.z.string().optional(),
    sort: zod_1.z.string().optional(),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.UuidSchema = zod_1.z.string().uuid('Harus berupa UUID yang valid.');
exports.EmailSchema = zod_1.z
    .string()
    .email('Format email tidak valid.')
    .toLowerCase()
    .trim();
exports.PasswordSchema = zod_1.z
    .string()
    .min(8, 'Password minimal 8 karakter.')
    .max(128, 'Password maksimal 128 karakter.')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Password harus mengandung minimal satu huruf kecil, satu huruf besar, dan satu angka.');
//# sourceMappingURL=validate.js.map