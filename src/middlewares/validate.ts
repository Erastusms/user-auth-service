import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
import { ValidationError, type ZodFieldError } from '@/shared/errors';

export interface RequestSchema {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
}

function validateWithZod<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  location: string
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fields: ZodFieldError[] = result.error.issues.map((err) => ({
      field: `${location}.${err.path.join('.')}`,
      message: err.message,
    }));
    throw new ValidationError(fields);
  }

  return result.data as z.infer<T>;
}

export function validate(schema: RequestSchema) {
  return function validationHook(
    request: FastifyRequest,
    _reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    try {
      if (schema.body) {
        (request as FastifyRequest & { body: unknown }).body = validateWithZod(
          schema.body,
          request.body,
          'body'
        );
      }
      if (schema.params) {
        (request as FastifyRequest & { params: unknown }).params = validateWithZod(
          schema.params,
          request.params,
          'params'
        );
      }
      if (schema.query) {
        (request as FastifyRequest & { query: unknown }).query = validateWithZod(
          schema.query,
          request.query,
          'query'
        );
      }
      if (schema.headers) {
        validateWithZod(schema.headers, request.headers, 'headers');
      }
      done();
    } catch (error) {
      done(error as Error);
    }
  };
}

// ── Common Reusable Schemas ───────────────────────────────────
export const IdParamSchema = z.object({
  id: z.string().uuid('ID harus berupa UUID yang valid.'),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100, 'Limit maksimal 100.').default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const UuidSchema = z.string().uuid('Harus berupa UUID yang valid.');

export const EmailSchema = z
  .string()
  .email('Format email tidak valid.')
  .toLowerCase()
  .trim();

export const PasswordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(128, 'Password maksimal 128 karakter.')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    'Password harus mengandung minimal satu huruf kecil, satu huruf besar, dan satu angka.'
  );
