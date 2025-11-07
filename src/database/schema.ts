/**
 * PostgreSQL Database Schema
 * Run this to initialize the database
 */

export const schema = `
-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  token_in VARCHAR(50) NOT NULL,
  token_out VARCHAR(50) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  slippage DECIMAL(5, 4) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  selected_dex VARCHAR(20),
  raydium_price DECIMAL(20, 8),
  meteora_price DECIMAL(20, 8),
  executed_price DECIMAL(20, 8),
  tx_hash VARCHAR(100),
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routing logs table
CREATE TABLE IF NOT EXISTS routing_logs (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
  raydium_price DECIMAL(20, 8) NOT NULL,
  raydium_fee DECIMAL(5, 4) NOT NULL,
  meteora_price DECIMAL(20, 8) NOT NULL,
  meteora_fee DECIMAL(5, 4) NOT NULL,
  selected_dex VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_logs_order_id ON routing_logs(order_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;
