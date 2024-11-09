import dotenv from 'dotenv';

dotenv.config();

// Parse Redis URL if provided (Railway format)
const parseRedisUrl = (url?: string) => {
  if (!url) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    };
  }
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
};

// Parse PostgreSQL URL if provided (Railway format)
const parseDbUrl = (url?: string) => {
  if (!url) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'dex_router',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
  }
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1), // Remove leading '/'
    user: parsed.username,
    password: parsed.password,
    // Railway PostgreSQL requires SSL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  };
};

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Redis (supports both URL and individual vars)
  redis: parseRedisUrl(process.env.REDIS_URL),

  // PostgreSQL (supports both URL and individual vars)
  database: parseDbUrl(process.env.DATABASE_URL),

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
