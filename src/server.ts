import { buildApp } from './app';
import { env } from '@/config/env';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

// ── Bootstrap ─────────────────────────────────────────────────
async function start(): Promise<void> {
  let app;

  try {
    // Cek koneksi database sebelum start server
    logger.info('Checking database connection...');
    await prisma.$connect();
    logger.info('Database connected');

    // Build Fastify app
    app = await buildApp();

    // Start listening
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(
      {
        port: env.PORT,
        host: env.HOST,
        env: env.NODE_ENV,
      },
      `Server running at http://${env.HOST}:${env.PORT}`
    );
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }

  // ── Graceful Shutdown ─────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    try {
      if (app) {
        // Stop accepting new connections, finish existing ones
        await app.close();
        logger.info('HTTP server closed');
      }

      // Tutup koneksi database
      await prisma.$disconnect();
      logger.info('Database disconnected');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop
  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart

  // ── Unhandled Rejections ──────────────────────────────────────
  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled Promise Rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    process.exit(1);
  });
}

// Run
start();
