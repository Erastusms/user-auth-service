import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Harus import SETELAH setup.ts sudah set env
let app: FastifyInstance;

describe('App Bootstrap + Health', () => {
  beforeAll(async () => {
    // Import di sini agar env sudah di-set oleh setup.ts
    const { buildApp } = await import('../../src/app');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('harus return 200 dengan status ok', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /v1/health', () => {
    it('harus return 200 dengan prefix v1', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('404 Handler', () => {
    it('harus return 404 untuk route yang tidak ada', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/route-yang-tidak-ada',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Security Headers', () => {
    it('harus ada X-Content-Type-Options header', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('harus ada X-Frame-Options header', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('harus ada X-Request-Id header di setiap response', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('harus return CORS headers untuk allowed origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3001',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001'
      );
    });
  });
});
