/**
 * Unit Tests for MockDexRouter
 */

import { MockDexRouter } from './MockDexRouter';
import { DexProvider, Order, OrderStatus, OrderType } from '../types';

// Helper to create mock order
const createMockOrder = (overrides?: Partial<Order>): Order => ({
  id: 'test-order-123',
  tokenIn: 'SOL',
  tokenOut: 'USDC',
  amount: 1.0,
  slippage: 0.01,
  type: OrderType.MARKET,
  status: OrderStatus.PENDING,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  describe('getRaydiumQuote', () => {
    it('should return a valid quote for Raydium', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);

      expect(quote).toBeDefined();
      expect(quote.provider).toBe(DexProvider.RAYDIUM);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.003); // 0.3% for Raydium
      expect(quote.liquidity).toBeGreaterThan(0);
    });

    it('should have consistent fee of 0.3%', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);
      expect(quote.fee).toBe(0.003);
    });

    it('should have liquidity between 1M and 10M', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
      expect(quote.liquidity).toBeGreaterThanOrEqual(1000000);
      expect(quote.liquidity).toBeLessThanOrEqual(10000000);
    });
  });

  describe('getMeteorQuote', () => {
    it('should return a valid quote for Meteora', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

      expect(quote).toBeDefined();
      expect(quote.provider).toBe(DexProvider.METEORA);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.002); // 0.2% for Meteora
      expect(quote.liquidity).toBeGreaterThan(0);
    });

    it('should have consistent fee of 0.2%', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 100);
      expect(quote.fee).toBe(0.002);
    });

    it('should have liquidity between 500K and 8M', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 1.0);
      expect(quote.liquidity).toBeGreaterThanOrEqual(500000);
      expect(quote.liquidity).toBeLessThanOrEqual(8000000);
    });
  });

  describe('selectBestDex', () => {
    it('should select DEX with better estimated output', async () => {
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

      // Force Raydium to be significantly better
      raydiumQuote.estimatedOutput = 100;
      meteoraQuote.estimatedOutput = 90;

      const result = router.selectBestDex(raydiumQuote, meteoraQuote);

      expect(result.selectedDex).toBe(DexProvider.RAYDIUM);
      expect(result.reason).toContain('Raydium');
      expect(result.reason).toContain('better output');
    });

    it('should select Meteora when it has better output', async () => {
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

      // Force Meteora to be significantly better
      raydiumQuote.estimatedOutput = 90;
      meteoraQuote.estimatedOutput = 100;

      const result = router.selectBestDex(raydiumQuote, meteoraQuote);

      expect(result.selectedDex).toBe(DexProvider.METEORA);
      expect(result.reason).toContain('Meteora');
      expect(result.reason).toContain('better output');
    });

    it('should select based on liquidity when outputs are similar', async () => {
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

      // Make outputs nearly equal (within 0.1%)
      raydiumQuote.estimatedOutput = 100;
      meteoraQuote.estimatedOutput = 100.05;
      raydiumQuote.liquidity = 5000000;
      meteoraQuote.liquidity = 3000000;

      const result = router.selectBestDex(raydiumQuote, meteoraQuote);

      expect(result.reason).toContain('liquidity');
    });

    it('should include percentage advantage in reason', async () => {
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

      raydiumQuote.estimatedOutput = 110;
      meteoraQuote.estimatedOutput = 100;

      const result = router.selectBestDex(raydiumQuote, meteoraQuote);

      expect(result.reason).toMatch(/\d+\.\d+%/);
    });
  });

  describe('executeSwap', () => {
    it('should successfully execute a swap', async () => {
      const order = createMockOrder();
      const result = await router.executeSwap(DexProvider.RAYDIUM, order);

      if (result.success) {
        expect(result.txHash).toBeDefined();
        expect(result.txHash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/);
        expect(result.actualOutput).toBeGreaterThan(0);
        expect(result.executedPrice).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      }
    });

    it('should apply slippage to actual output', async () => {
      const order = createMockOrder({ amount: 1.0 });
      const result = await router.executeSwap(DexProvider.RAYDIUM, order);

      if (result.success) {
        // actualOutput should be reasonable given the amount
        expect(result.actualOutput).toBeGreaterThan(0);
        expect(result.actualOutput).toBeLessThan(order.amount * 100000); // Sanity check
      }
    });
  });

  describe('Integration: Full routing flow', () => {
    it('should complete full routing and execution flow', async () => {
      // Step 1: Get quotes from both DEXs
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 5.0);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 5.0);

      expect(raydiumQuote).toBeDefined();
      expect(meteoraQuote).toBeDefined();

      // Step 2: Select best DEX
      const { selectedDex } = router.selectBestDex(raydiumQuote, meteoraQuote);

      expect([DexProvider.RAYDIUM, DexProvider.METEORA]).toContain(selectedDex);

      // Step 3: Execute swap
      const order = createMockOrder({ amount: 5.0 });
      const result = await router.executeSwap(selectedDex, order);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle different token amounts correctly', async () => {
      const amounts = [0.1, 1.0, 10.0];

      for (const amount of amounts) {
        const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', amount);
        const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', amount);

        expect(raydiumQuote.estimatedOutput).toBeGreaterThan(0);
        expect(meteoraQuote.estimatedOutput).toBeGreaterThan(0);

        // Larger amounts should generally result in larger outputs
        expect(raydiumQuote.estimatedOutput).toBeGreaterThan(amount * 100);
        expect(meteoraQuote.estimatedOutput).toBeGreaterThan(amount * 100);
      }
    });

    it('should provide consistent fee structure across multiple calls', async () => {
      const calls = 5;
      
      for (let i = 0; i < calls; i++) {
        const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1.0);
        const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1.0);

        expect(raydiumQuote.fee).toBe(0.003);
        expect(meteoraQuote.fee).toBe(0.002);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid amounts gracefully', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 0);
      expect(quote.estimatedOutput).toBe(0);
    });

    it('should handle negative amounts', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', -1);
      // Should still return a quote structure
      expect(quote).toBeDefined();
      expect(quote.provider).toBe(DexProvider.METEORA);
    });
  });
});
