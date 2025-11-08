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
   * GET /api/orders/execute
   * Submit order and upgrade to WebSocket for status streaming
   */
  fastify.get('/api/orders/execute', {
    websocket: true
  }, async (connection: SocketStream, request: FastifyRequest) => {
    try {
      // Parse order from query or initial message
      let orderInput: OrderInput | null = null;
      const orderId = uuidv4();

        // Listen for initial order data
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());

            // If this is the order submission
            if (data.type === 'submit_order' && !orderInput) {
              orderInput = data.order as OrderInput;

              // Validate order
              if (!orderInput.tokenIn || !orderInput.tokenOut || !orderInput.amount) {
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  error: 'Missing required fields: tokenIn, tokenOut, amount',
                }));
                connection.socket.close();
                return;
              }

              // Send orderId acknowledgment
              connection.socket.send(JSON.stringify({
                type: 'order_accepted',
                orderId,
                timestamp: new Date().toISOString(),
              }));

              // Store connection
              activeConnections.set(orderId, connection);

              // Create order in database
              const db = new Database();
              await db.createOrder(orderId, orderInput);
              await db.close();

              // Send initial status
              connection.socket.send(JSON.stringify({
                type: 'status_update',
                orderId,
                status: OrderStatus.PENDING,
                timestamp: new Date().toISOString(),
              }));

              // Enqueue for processing
              await enqueueOrder({ orderId, order: orderInput });

              console.log(`📨 Order ${orderId} submitted and queued`);
            }
          } catch (error: any) {
            console.error('Error processing message:', error);
            connection.socket.send(JSON.stringify({
              type: 'error',
              error: error.message,
            }));
          }
        });

        // Handle disconnection
        connection.socket.on('close', () => {
          activeConnections.delete(orderId);
          console.log(`🔌 WebSocket closed for order ${orderId}`);
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
    });

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
