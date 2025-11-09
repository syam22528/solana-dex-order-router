/**
 * Database Client - PostgreSQL connection and query methods
 */

import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { schema } from './schema';
import {
  Order,
  OrderInput,
  OrderType,
  OrderStatus,
  OrderRecord,
  RoutingLogRecord,
  RoutingDecision,
} from '../types';

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(config.database);
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    try {
      await this.pool.query(schema);
      console.log('Database schema initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(
    id: string,
    orderInput: OrderInput
  ): Promise<Order> {
    const query = `
      INSERT INTO orders (
        id, token_in, token_out, amount, slippage, type, status, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
      RETURNING *
    `;

    const values = [
      id,
      orderInput.tokenIn,
      orderInput.tokenOut,
      orderInput.amount,
      orderInput.slippage || config.dex.defaultSlippage,
      orderInput.type || OrderType.MARKET,
      OrderStatus.PENDING,
    ];

    const result = await this.pool.query<OrderRecord>(query, values);
    return this.mapRecordToOrder(result.rows[0]);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    updates: Partial<Order> = {}
  ): Promise<void> {
    const fields: string[] = ['status = $2'];
    const values: any[] = [orderId, status];
    let paramIndex = 3;

    if (updates.selectedDex) {
      fields.push(`selected_dex = $${paramIndex++}`);
      values.push(updates.selectedDex);
    }
    if (updates.raydiumPrice) {
      fields.push(`raydium_price = $${paramIndex++}`);
      values.push(updates.raydiumPrice);
    }
    if (updates.meteoraPrice) {
      fields.push(`meteora_price = $${paramIndex++}`);
      values.push(updates.meteoraPrice);
    }
    if (updates.executedPrice) {
      fields.push(`executed_price = $${paramIndex++}`);
      values.push(updates.executedPrice);
    }
    if (updates.txHash) {
      fields.push(`tx_hash = $${paramIndex++}`);
      values.push(updates.txHash);
    }
    if (updates.error) {
      fields.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }
    if (updates.retryCount !== undefined) {
      fields.push(`retry_count = $${paramIndex++}`);
      values.push(updates.retryCount);
    }

    const query = `
      UPDATE orders
      SET ${fields.join(', ')}
      WHERE id = $1
    `;

    await this.pool.query(query, values);
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const result = await this.pool.query<OrderRecord>(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRecordToOrder(result.rows[0]);
  }

  /**
   * Get all orders (with pagination)
   */
  async getAllOrders(limit: number = 100, offset: number = 0): Promise<Order[]> {
    const result = await this.pool.query<OrderRecord>(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows.map(row => this.mapRecordToOrder(row));
  }

  /**
   * Log routing decision
   */
  async logRoutingDecision(decision: RoutingDecision): Promise<void> {
    const query = `
      INSERT INTO routing_logs (
        order_id, raydium_price, raydium_fee, meteora_price, meteora_fee, selected_dex, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      decision.orderId,
      decision.raydiumQuote.price,
      decision.raydiumQuote.fee,
      decision.meteoraQuote.price,
      decision.meteoraQuote.fee,
      decision.selectedDex,
      decision.reason,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Get routing logs for an order
   */
  async getRoutingLogs(orderId: string): Promise<RoutingLogRecord[]> {
    const result = await this.pool.query<RoutingLogRecord>(
      'SELECT * FROM routing_logs WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );

    return result.rows;
  }

  /**
   * Map database record to Order object
   */
  private mapRecordToOrder(record: OrderRecord): Order {
    return {
      id: record.id,
      tokenIn: record.token_in,
      tokenOut: record.token_out,
      amount: parseFloat(record.amount.toString()),
      slippage: parseFloat(record.slippage.toString()),
      type: record.type as OrderType,
      status: record.status as OrderStatus,
      selectedDex: record.selected_dex as any,
      raydiumPrice: record.raydium_price ? parseFloat(record.raydium_price.toString()) : undefined,
      meteoraPrice: record.meteora_price ? parseFloat(record.meteora_price.toString()) : undefined,
      executedPrice: record.executed_price ? parseFloat(record.executed_price.toString()) : undefined,
      txHash: record.tx_hash || undefined,
      error: record.error || undefined,
      retryCount: record.retry_count,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default Database;
