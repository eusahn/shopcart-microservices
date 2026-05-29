import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_MAX_CONNECTIONS,
});

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             TEXT NOT NULL,
      total_cents         BIGINT NOT NULL,
      currency            TEXT NOT NULL DEFAULT 'USD',
      status              TEXT NOT NULL DEFAULT 'PENDING',
      shipping_address_id TEXT NOT NULL DEFAULT '',
      idempotency_key     TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id        TEXT NOT NULL,
      sku               TEXT NOT NULL,
      name              TEXT NOT NULL,
      quantity          INT NOT NULL,
      unit_price_cents  BIGINT NOT NULL,
      PRIMARY KEY (order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
  `);
}
