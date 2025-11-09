/**
 * Main Server - Fastify with WebSocket support
 * Solana DEX Order Router
 */

import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { config } from './config';
import { Database } from './database';
import { createWorker, setStatusUpdateHandler } from './queue/orderQueue';
import { setupRoutes, broadcastStatusUpdate } from './routes/orderRoutes';

async function start() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Global database instance
  let db: Database;

  try {
    // Register WebSocket plugin
    await fastify.register(websocketPlugin);

    // Initialize database
    console.log('Connecting to database...');
    db = new Database();
    await db.initialize();
    console.log('Database connected');

    // Setup routes
    setupRoutes(fastify);

    // Connect status updates from queue to WebSocket broadcasts
    setStatusUpdateHandler((orderId, status, data) => {
      broadcastStatusUpdate(orderId, status, data);
    });

    // Start BullMQ worker
    const worker = createWorker();

    // Start server
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    console.log('\nSolana DEX Order Router Started!');
    console.log(`Server: http://${config.host}:${config.port}`);
    console.log(`WebSocket: ws://${config.host}:${config.port}/api/orders/execute`);
    console.log(`Health: http://${config.host}:${config.port}/health`);
    console.log(`Queue: ${config.queue.concurrency} concurrent workers`);
    console.log(`Mock Mode: ${config.mock.enabled ? 'ENABLED' : 'DISABLED'}\n`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, shutting down gracefully...`);
        
        await worker.close();
        await fastify.close();
        if (db) await db.close();
        
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
start();
