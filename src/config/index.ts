import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // PostgreSQL
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dex_router',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  // Queue Settings
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    maxOrdersPerMinute: 100,
  },

  // DEX Settings
  dex: {
    defaultSlippage: 0.01, // 1%
    quoteTimeout: 5000, // 5 seconds
  },

  // Mock Settings (for development)
  mock: {
    enabled: process.env.MOCK_DEX === 'true' || true, // Default to mock
    basePrice: 50000, // Base price for mocks (e.g., SOL/USDC)
  },
};
