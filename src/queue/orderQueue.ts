/**
 * BullMQ Order Queue Worker
 * Processes orders with concurrency control and retry logic
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { OrderJobData, OrderStatus, DexProvider } from '../types';
import { Database } from '../database';
import { MockDexRouter } from '../services/MockDexRouter';

// Redis connections
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

// Order queue
export const orderQueue = new Queue('orders', {
  connection,
  defaultJobOptions: {
    attempts: config.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: config.queue.retryDelay,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500,     // Keep last 500 failed jobs
  },
});

// Rate limiter: 100 orders per minute
const rateLimiter = {
  max: config.queue.maxOrdersPerMinute,
  duration: 60000, // 1 minute in ms
};

// Status update emitter (used by WebSocket)
export type StatusUpdateHandler = (orderId: string, status: OrderStatus, data?: any) => void;
let statusUpdateHandler: StatusUpdateHandler | null = null;

export function setStatusUpdateHandler(handler: StatusUpdateHandler) {
  statusUpdateHandler = handler;
}

function emitStatusUpdate(orderId: string, status: OrderStatus, data?: any) {
  if (statusUpdateHandler) {
    statusUpdateHandler(orderId, status, data);
  }
}

/**
 * Process order through the full lifecycle
 */
async function processOrder(job: Job<OrderJobData>): Promise<void> {
  const { orderId, order } = job.data;
  const db = new Database();
  const dexRouter = new MockDexRouter();

  try {
    console.log(`[${orderId}] Processing order: ${order.amount} ${order.tokenIn} → ${order.tokenOut}`);

    // Step 1: ROUTING - Fetch quotes from both DEXs
    emitStatusUpdate(orderId, OrderStatus.ROUTING);
    await db.updateOrderStatus(orderId, OrderStatus.ROUTING);

    console.log(`[${orderId}] Fetching quotes from Raydium and Meteora...`);
    
    const { raydium, meteora } = await dexRouter.getBothQuotes(
      order.tokenIn,
      order.tokenOut,
      order.amount
    );

    console.log(`[${orderId}] Raydium: $${raydium.price.toFixed(2)} (fee: ${(raydium.fee * 100).toFixed(2)}%) | Meteora: $${meteora.price.toFixed(2)} (fee: ${(meteora.fee * 100).toFixed(2)}%)`);

    // Select best DEX
    const { selectedDex, reason } = dexRouter.selectBestDex(raydium, meteora);
    console.log(`[${orderId}] Selected ${selectedDex}: ${reason}`);

    // Log routing decision
    await db.logRoutingDecision({
      orderId,
      raydiumQuote: raydium,
      meteoraQuote: meteora,
      selectedDex,
      reason,
      timestamp: new Date(),
    });

    // Update order with routing info
    await db.updateOrderStatus(orderId, OrderStatus.ROUTING, {
      selectedDex,
      raydiumPrice: raydium.price,
      meteoraPrice: meteora.price,
    });

    emitStatusUpdate(orderId, OrderStatus.ROUTING, {
      selectedDex,
      raydiumPrice: raydium.price,
      meteoraPrice: meteora.price,
      reason,
    });

    // Step 2: BUILDING - Create transaction
    emitStatusUpdate(orderId, OrderStatus.BUILDING);
    await db.updateOrderStatus(orderId, OrderStatus.BUILDING);

    // Simulate transaction building (500ms delay)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get full order details
    const fullOrder = await db.getOrder(orderId);
    if (!fullOrder) {
      throw new Error('Order not found');
    }

    // Step 3: SUBMITTED - Send to blockchain
    emitStatusUpdate(orderId, OrderStatus.SUBMITTED);
    await db.updateOrderStatus(orderId, OrderStatus.SUBMITTED);

    console.log(`[${orderId}] Executing swap on ${selectedDex}...`);

    // Execute swap
    const swapResult = await dexRouter.executeSwap(selectedDex, fullOrder);

    if (!swapResult.success) {
      throw new Error(swapResult.error || 'Swap execution failed');
    }

    // Step 4: CONFIRMED - Transaction successful
    console.log(`[${orderId}] Swap confirmed! TX: ${swapResult.txHash}`);

    await db.updateOrderStatus(orderId, OrderStatus.CONFIRMED, {
      txHash: swapResult.txHash,
      executedPrice: swapResult.executedPrice,
    });

    emitStatusUpdate(orderId, OrderStatus.CONFIRMED, {
      txHash: swapResult.txHash,
      executedPrice: swapResult.executedPrice,
      actualOutput: swapResult.actualOutput,
    });

  } catch (error: any) {
    console.error(`[${orderId}] ❌ Error:`, error.message);

    // Update retry count
    const currentOrder = await db.getOrder(orderId);
    const retryCount = (currentOrder?.retryCount || 0) + 1;

    // If max retries exceeded, mark as failed
    if (retryCount >= config.queue.maxRetries) {
      await db.updateOrderStatus(orderId, OrderStatus.FAILED, {
        error: error.message,
        retryCount,
      });

      emitStatusUpdate(orderId, OrderStatus.FAILED, {
        error: error.message,
        retryCount,
      });
    } else {
      // Update retry count for next attempt
      await db.updateOrderStatus(orderId, OrderStatus.PENDING, {
        error: error.message,
        retryCount,
      });
    }

    throw error; // Re-throw to trigger BullMQ retry
  } finally {
    await db.close();
  }
}

/**
 * Create and start the worker
 */
export function createWorker(): Worker {
  const worker = new Worker('orders', processOrder, {
    connection,
    concurrency: config.queue.concurrency,
    limiter: rateLimiter,
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`Worker started with ${config.queue.concurrency} concurrent processors`);

  return worker;
}

/**
 * Add order to queue
 */
export async function enqueueOrder(jobData: OrderJobData): Promise<string> {
  const job = await orderQueue.add('process-order', jobData);
  return job.id!;
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
