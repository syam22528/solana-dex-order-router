/**
 * Mock DEX Router - Simulates Raydium and Meteora quote fetching and swap execution
 * This allows testing the full order flow without real blockchain integration
 */

import { DexProvider, DexQuote, SwapResult, Order } from '../types';
import { config } from '../config';

// Helper to simulate network delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockDexRouter {
  private basePrice: number;

  constructor(basePrice: number = config.mock.basePrice) {
    this.basePrice = basePrice;
  }

  /**
   * Get quote from Raydium (mock)
   * Simulates 200ms network latency
   * Price variance: ±2-4% from base
   */
  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuote> {
    // Simulate network delay
    await sleep(200);

    // Generate price with variance (0.98 to 1.02 of base price)
    const priceVariance = 0.98 + Math.random() * 0.04;
    const price = this.basePrice * priceVariance;
    const fee = 0.003; // 0.3% Raydium fee
    const estimatedOutput = amount * price * (1 - fee);

    // Simulate liquidity (random between 1M and 10M)
    const liquidity = 1000000 + Math.random() * 9000000;

    return {
      provider: DexProvider.RAYDIUM,
      price,
      fee,
      estimatedOutput,
      liquidity,
    };
  }

  /**
   * Get quote from Meteora (mock)
   * Simulates 200ms network latency
   * Price variance: ±3-5% from base (slightly more volatile)
   */
  async getMeteorQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuote> {
    // Simulate network delay
    await sleep(200);

    // Generate price with variance (0.97 to 1.02 of base price)
    const priceVariance = 0.97 + Math.random() * 0.05;
    const price = this.basePrice * priceVariance;
    const fee = 0.002; // 0.2% Meteora fee (lower than Raydium)
    const estimatedOutput = amount * price * (1 - fee);

    // Simulate liquidity (random between 500K and 8M)
    const liquidity = 500000 + Math.random() * 7500000;

    return {
      provider: DexProvider.METEORA,
      price,
      fee,
      estimatedOutput,
      liquidity,
    };
  }

  /**
   * Compare quotes and select best DEX
   * Selection criteria:
   * 1. Highest estimated output (best price after fees)
   * 2. If outputs are within 0.1%, prefer higher liquidity
   */
  selectBestDex(raydiumQuote: DexQuote, meteoraQuote: DexQuote): {
    selectedDex: DexProvider;
    reason: string;
  } {
    const outputDiff = Math.abs(
      raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput
    );
    const avgOutput = (raydiumQuote.estimatedOutput + meteoraQuote.estimatedOutput) / 2;
    const diffPercentage = (outputDiff / avgOutput) * 100;

    // If price difference is negligible (<0.1%), choose based on liquidity
    if (diffPercentage < 0.1) {
      if (raydiumQuote.liquidity > meteoraQuote.liquidity) {
        return {
          selectedDex: DexProvider.RAYDIUM,
          reason: `Similar prices, Raydium has higher liquidity ($${(
            raydiumQuote.liquidity / 1000000
          ).toFixed(2)}M vs $${(meteoraQuote.liquidity / 1000000).toFixed(2)}M)`,
        };
      } else {
        return {
          selectedDex: DexProvider.METEORA,
          reason: `Similar prices, Meteora has higher liquidity ($${(
            meteoraQuote.liquidity / 1000000
          ).toFixed(2)}M vs $${(raydiumQuote.liquidity / 1000000).toFixed(2)}M)`,
        };
      }
    }

    // Otherwise, choose DEX with better output
    if (raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput) {
      const advantage = (
        ((raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput) /
          meteoraQuote.estimatedOutput) *
        100
      ).toFixed(3);
      return {
        selectedDex: DexProvider.RAYDIUM,
        reason: `Raydium offers ${advantage}% better output (${raydiumQuote.estimatedOutput.toFixed(
          2
        )} vs ${meteoraQuote.estimatedOutput.toFixed(2)})`,
      };
    } else {
      const advantage = (
        ((meteoraQuote.estimatedOutput - raydiumQuote.estimatedOutput) /
          raydiumQuote.estimatedOutput) *
        100
      ).toFixed(3);
      return {
        selectedDex: DexProvider.METEORA,
        reason: `Meteora offers ${advantage}% better output (${meteoraQuote.estimatedOutput.toFixed(
          2
        )} vs ${raydiumQuote.estimatedOutput.toFixed(2)})`,
      };
    }
  }

  /**
   * Execute swap on selected DEX (mock)
   * Simulates 2-3 second execution time
   * 5% chance of random failure (for testing error handling)
   */
  async executeSwap(dex: DexProvider, order: Order): Promise<SwapResult> {
    // Simulate execution time (2-3 seconds)
    const executionTime = 2000 + Math.random() * 1000;
    await sleep(executionTime);

    // 5% chance of random failure (for testing)
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: `${dex} network timeout - transaction failed to confirm`,
      };
    }

    // Generate mock transaction hash
    const txHash = this.generateMockTxHash();

    // Calculate executed price (slight variance from quoted price due to slippage)
    const slippageVariance = -order.slippage + Math.random() * order.slippage;
    const executedPrice = order.selectedDex === DexProvider.RAYDIUM
      ? (order.raydiumPrice || this.basePrice) * (1 + slippageVariance)
      : (order.meteoraPrice || this.basePrice) * (1 + slippageVariance);

    const fee = dex === DexProvider.RAYDIUM ? 0.003 : 0.002;
    const actualOutput = order.amount * executedPrice * (1 - fee);

    return {
      success: true,
      txHash,
      executedPrice,
      actualOutput,
    };
  }

  /**
   * Generate a realistic-looking mock Solana transaction hash
   */
  private generateMockTxHash(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let hash = '';
    for (let i = 0; i < 88; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }

  /**
   * Fetch quotes from both DEXs concurrently
   */
  async getBothQuotes(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<{ raydium: DexQuote; meteora: DexQuote }> {
    const [raydium, meteora] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount),
    ]);

    return { raydium, meteora };
  }
}

export default MockDexRouter;
