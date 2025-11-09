/**
 * Order Execution Routes - HTTP → WebSocket upgrade pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { OrderInput, OrderStatus } from '../types';
import { Database } from '../database';
import { enqueueOrder, getQueueMetrics } from '../queue/orderQueue';
import { SocketStream } from '@fastify/websocket';

// Active WebSocket connections (orderId => socket)
const activeConnections = new Map<string, SocketStream>();

export function setupRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/orders/execute
   * Submit order and return orderId immediately
   * HTTP → WebSocket upgrade pattern
   */
  fastify.post<{ Body: OrderInput }>(
    '/api/orders/execute',
    async (request, reply) => {
      const orderInput = request.body;

      // Validate order
      if (!orderInput.tokenIn || !orderInput.tokenOut || !orderInput.amount) {
        return reply.code(400).send({
          error: 'Missing required fields: tokenIn, tokenOut, amount',
        });
      }

      // Generate orderId
      const orderId = uuidv4();

      // Create order in database
      const db = new Database();
      await db.createOrder(orderId, orderInput);
      await db.close();

      // Enqueue for processing
      await enqueueOrder({ orderId, order: orderInput });

      console.log(`Order ${orderId} submitted and queued`);

      // Return orderId immediately (HTTP response)
      return reply.code(201).send({
        orderId,
        status: OrderStatus.PENDING,
        message: 'Order submitted successfully. Connect to WebSocket for status updates.',
        websocketUrl: `/api/orders/${orderId}/stream`,
      });
    }
  );

  /**
   * GET /api/orders/:orderId/stream
   * WebSocket endpoint for real-time status updates
   */
  fastify.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId/stream',
    { websocket: true },
    async (connection: SocketStream, request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;

      try {
        // Verify order exists
        const db = new Database();
        const order = await db.getOrder(orderId);
        await db.close();

        if (!order) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            error: 'Order not found',
          }));
          connection.socket.close();
          return;
        }

        // Store connection
        activeConnections.set(orderId, connection);

        // Send connection acknowledgment
        connection.socket.send(JSON.stringify({
          type: 'connected',
          orderId,
          currentStatus: order.status,
          timestamp: new Date().toISOString(),
        }));

        console.log(`WebSocket connected for order ${orderId}`);

        // Handle disconnection
        connection.socket.on('close', () => {
          activeConnections.delete(orderId);
          console.log(`WebSocket closed for order ${orderId}`);
        });

        connection.socket.on('error', (error) => {
          console.error(`WebSocket error for order ${orderId}:`, error);
          activeConnections.delete(orderId);
        });

      } catch (error: any) {
        console.error('Route error:', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          error: error.message,
        }));
        connection.socket.close();
      }
    }
  );

  /**
   * GET /api/orders/:orderId
   * Get order status (REST fallback)
   */
  fastify.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId',
    async (request, reply) => {
      const { orderId } = request.params;

      const db = new Database();
      const order = await db.getOrder(orderId);
      await db.close();

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return order;
    }
  );

  /**
   * GET /api/orders
   * Get all orders with pagination
   */
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/orders',
    async (request, reply) => {
      const limit = parseInt(request.query.limit || '100', 10);
      const offset = parseInt(request.query.offset || '0', 10);

      const db = new Database();
      const orders = await db.getAllOrders(limit, offset);
      await db.close();

      return { orders, limit, offset, count: orders.length };
    }
  );

  /**
   * GET /api/orders/:orderId/routing
   * Get routing logs for an order
   */
  fastify.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId/routing',
    async (request, reply) => {
      const { orderId } = request.params;

      const db = new Database();
      const logs = await db.getRoutingLogs(orderId);
      await db.close();

      return { orderId, logs };
    }
  );

  /**
   * GET /api/queue/metrics
   * Get queue statistics
   */
  fastify.get('/api/queue/metrics', async (request, reply) => {
    const metrics = await getQueueMetrics();
    return metrics;
  });

  /**
   * GET /health
   * Health check endpoint
   */
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: await getQueueMetrics(),
    };
  });
}

/**
 * Broadcast status update to connected WebSocket client
 */
export function broadcastStatusUpdate(orderId: string, status: OrderStatus, data?: any) {
  const connection = activeConnections.get(orderId);

  if (connection && connection.socket.readyState === 1) { // OPEN state
    connection.socket.send(JSON.stringify({
      type: 'status_update',
      orderId,
      status,
      timestamp: new Date().toISOString(),
      data,
    }));
  }
}
