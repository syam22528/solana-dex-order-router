/**
 * Core Type Definitions for Solana DEX Order Router
 */

// Order Types
export enum OrderType {
  MARKET = 'MARKET',  // Immediate execution at best available price
  LIMIT = 'LIMIT',    // Execute when target price reached
  SNIPER = 'SNIPER'   // Execute on token launch/migration
}

// Order Status Lifecycle
export enum OrderStatus {
  PENDING = 'pending',       // Order received and queued
  ROUTING = 'routing',       // Comparing DEX prices
  BUILDING = 'building',     // Creating transaction
  SUBMITTED = 'submitted',   // Transaction sent to network
  CONFIRMED = 'confirmed',   // Transaction successful
  FAILED = 'failed'          // Any step failed
}

// DEX Providers
export enum DexProvider {
  RAYDIUM = 'raydium',
  METEORA = 'meteora'
}

// Order Input (from client)
export interface OrderInput {
  tokenIn: string;         // Token to sell (e.g., 'SOL')
  tokenOut: string;        // Token to buy (e.g., 'USDC')
  amount: number;          // Amount to swap
  slippage?: number;       // Slippage tolerance (default: 0.01 = 1%)
  type?: OrderType;        // Order type (default: MARKET)
}

// Complete Order (in database)
export interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage: number;
  type: OrderType;
  status: OrderStatus;
  selectedDex?: DexProvider;
  raydiumPrice?: number;
  meteoraPrice?: number;
  executedPrice?: number;
  txHash?: string;
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// DEX Quote Response
export interface DexQuote {
  provider: DexProvider;
  price: number;          // Exchange rate
  fee: number;            // Trading fee (e.g., 0.003 = 0.3%)
  estimatedOutput: number; // Expected output amount
  liquidity: number;      // Pool liquidity
}

// Routing Decision
export interface RoutingDecision {
  orderId: string;
  raydiumQuote: DexQuote;
  meteoraQuote: DexQuote;
  selectedDex: DexProvider;
  reason: string;
  timestamp: Date;
}

// Swap Execution Result
export interface SwapResult {
  success: boolean;
  txHash?: string;
  executedPrice?: number;
  actualOutput?: number;
  error?: string;
}

// WebSocket Status Update
export interface StatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    selectedDex?: DexProvider;
    raydiumPrice?: number;
    meteoraPrice?: number;
    txHash?: string;
    executedPrice?: number;
    error?: string;
  };
}

// Queue Job Data
export interface OrderJobData {
  orderId: string;
  order: OrderInput;
}

// Database Schema Types
export interface OrderRecord {
  id: string;
  token_in: string;
  token_out: string;
  amount: number;
  slippage: number;
  type: string;
  status: string;
  selected_dex: string | null;
  raydium_price: number | null;
  meteora_price: number | null;
  executed_price: number | null;
  tx_hash: string | null;
  error: string | null;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface RoutingLogRecord {
  id: string;
  order_id: string;
  raydium_price: number;
  raydium_fee: number;
  meteora_price: number;
  meteora_fee: number;
  selected_dex: string;
  reason: string;
  created_at: Date;
}
