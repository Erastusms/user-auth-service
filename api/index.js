'use strict';

/**
 * Vercel Serverless Handler untuk Fastify
 *
 * Kenapa plain JS bukan TypeScript?
 * - File ini tidak perlu di-compile (tidak ada path alias atau TS-specific syntax)
 * - Menghindari masalah compilation chain yang menjadi akar masalah deploy
 * - dist/ sudah di-generate oleh build step (npm run build = tsc + tsc-alias)
 *
 * Flow: Vercel runs "npm run build" → dist/ terisi → api/index.js require dari dist/app
 */

let app = null;

module.exports = async (req, res) => {
    // Lazy initialization: build Fastify app sekali, reuse di warm invocations
    if (!app) {
        const { buildApp } = require('../dist/app');
        app = await buildApp();
        await app.ready();
    }

    // Teruskan request ke Fastify internal HTTP server
    app.server.emit('request', req, res);
};